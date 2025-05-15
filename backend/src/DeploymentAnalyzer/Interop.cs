using Microsoft.JSInterop;
using Azure.Deployments.Core.Helpers;
using Azure.Deployments.Templates.Engines;
using Azure.Deployments.Core.Constants;
using Azure.Deployments.Core.Configuration;
using Azure.Deployments.Core.Exceptions;
using Azure.Deployments.Core.Definitions.Schema;
using Azure.Deployments.Expression.Intermediate;
using Azure.Deployments.Core.Definitions;
using Microsoft.WindowsAzure.ResourceStack.Common.Json;
using Azure.Deployments.Core.Entities;
using Azure.Deployments.Expression.Intermediate.Extensions;
using System.Collections.Immutable;
using Azure.Deployments.Templates.ParsedEntities;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace DeploymentAnalyzer;

public class Interop
{
    public record GetTemplateInfoRequest(
        string Template);

    public record GetTemplateInfoResponse(
        string? TemplateHash,
        string? GeneratorName,
        string? GeneratorVersion,
        string? ValidationMessage);

    public record GetParsedTemplateRequest(
        string Template,
        string? Parameters,
        GetParsedTemplateRequest.MetadataDefinition Metadata,
        ImmutableArray<GetParsedTemplateRequest.ExternalInputValue>? ExternalInputs)
    {
        public record MetadataDefinition(
            string? TenantId,
            string? SubscriptionId,
            string? ResourceGroup,
            string? Location,
            string? DeploymentName);

        public record ExternalInputValue(
            string Kind,
            JsonElement? Config,
            JsonElement Value);
    }

    public record GetParsedTemplateResponse(
        ImmutableArray<JsonElement> PredictedResources,
        ImmutableArray<string> Diagnostics);

    [JSInvokable]
    public GetTemplateInfoResponse GetTemplateInfo(GetTemplateInfoRequest request)
    {
        Template template;
        try
        {
            template = TemplateEngine.ParseTemplate(request.Template);
        }
        catch (Exception ex)
        {
            return new(null, null, null, ex.Message);
        }

        if (!TemplateHelpers.TryGetTemplateGeneratorObject(template.ToJToken(), out var generator))
        {
            generator = null;
        }

        string? validationMessage = null;
        try
        {
            TemplateEngine.ValidateTemplate(template, CoreConstants.ApiVersion20240701, TemplateDeploymentScope.NotSpecified);
        }
        catch (TemplateException ex)
        {
            validationMessage = ex.Message;
        }

        var templateHash = TemplateHelpers.ComputeTemplateHash(template.ToJToken());

        return new(
            templateHash,
            generator?.Name,
            generator?.Version,
            validationMessage);
    }

    [JSInvokable]
    public async Task<GetParsedTemplateResponse> GetParsedTemplate(GetParsedTemplateRequest request)
    {
        var template = TemplateEngine.ParseTemplate(request.Template);
        var parameters = request.Parameters?.TryFromJson<DeploymentParametersDefinition>();

        var scope = template.Schema.Value.Split('/').Last().TrimEnd('#').ToLowerInvariant() switch
        {
            "tenantdeploymenttemplate.json" => TemplateDeploymentScope.Tenant,
            "managementgroupdeploymenttemplate.json" => TemplateDeploymentScope.ManagementGroup,
            "subscriptiondeploymenttemplate.json" => TemplateDeploymentScope.Subscription,
            _ => TemplateDeploymentScope.ResourceGroup
        };

        var expansionResult = await TemplateEngine.ExpandNestedDeployments(
            CoreConstants.ApiVersion20250401,
            scope,
            template,
            parameters: ResolveParameters(parameters),
            rootDeploymentMetadata: GetDeploymentMetadata(request.Metadata, scope, template),
            cancellationToken: CancellationToken.None);

        return new(
            [
                ..expansionResult.preflightResources.Select(x => JsonElementFactory.CreateElement(JsonExtensions.ToJson(DeploymentPreflightResourceWithParsedExpressions.From(x)))),
                ..expansionResult.extensibleResources.Select(x => JsonElementFactory.CreateElement(JsonExtensions.ToJson(x))),
            ],
            [
                ..expansionResult.diagnostics.Select(d => $"{d.Target} {d.Level} {d.Code}: {d.Message}")
            ]);
    }

    private static Dictionary<string, ITemplateLanguageExpression>? ResolveParameters(DeploymentParametersDefinition? deploymentParameters)
        => deploymentParameters?.Parameters?.ToDictionary(kvp => kvp.Key, kvp => ResolveParameter(kvp.Key, kvp.Value));

    private static ITemplateLanguageExpression ResolveParameter(
        string parameterName,
        DeploymentParameterDefinition parameter)
    {
        if (parameter.Value is not null)
        {
            return JTokenConverter.ConvertToLanguageExpression(parameter.Value);
        }

        if (parameter.Reference is not null)
        {
            return new FunctionExpression("parameters", [parameterName.AsExpression()], null, irreducible: true);
        }

        if (parameter.Expression is not null)
        {
            return ExpressionParser.ParseLanguageExpression(parameter.Expression);
        }

        throw new InvalidOperationException(
            $"Parameters compilation produced an invalid object for parameter '{parameterName}'.");
    }

    private static Dictionary<string, ITemplateLanguageExpression> GetDeploymentMetadata(
        GetParsedTemplateRequest.MetadataDefinition arguments,
        TemplateDeploymentScope scope,
        Template template)
    {
        Dictionary<string, ITemplateLanguageExpression> metadata = new(StringComparer.OrdinalIgnoreCase);

        if (arguments.TenantId is not null)
        {
            metadata[DeploymentMetadata.TenantKey] = new ObjectExpression(
                [
                    new("countryCode".AsExpression(), MetadataPlaceholder("tenant", "countryCode")),
                    new("displayName".AsExpression(), MetadataPlaceholder("tenant", "displayName")),
                    new("id".AsExpression(), $"/tenants/{arguments.TenantId}".AsExpression()),
                    new("tenantId".AsExpression(), arguments.TenantId.AsExpression()),
                ],
                position: null);
        }

        if (arguments.SubscriptionId is not null)
        {
            if (scope is not TemplateDeploymentScope.Subscription and not TemplateDeploymentScope.ResourceGroup)
            {
                throw new InvalidOperationException($"Subscription ID cannot be specified for a template of scope {scope}");
            }

            metadata[DeploymentMetadata.SubscriptionKey] = new ObjectExpression(
                [
                    new("id".AsExpression(), $"/subscriptions/{arguments.SubscriptionId}".AsExpression()),
                    new("subscriptionId".AsExpression(), arguments.SubscriptionId.AsExpression()),
                    new(
                        "tenantId".AsExpression(),
                        arguments.TenantId?.AsExpression() ?? MetadataPlaceholder("tenant", "tenantId")),
                    new("displayName".AsExpression(), MetadataPlaceholder("subscription", "displayName")),
                ],
                position: null);
        }

        if (arguments.ResourceGroup is not null)
        {
            if (scope is not TemplateDeploymentScope.ResourceGroup)
            {
                throw new InvalidOperationException($"Resource group name cannot be specified for a template of scope {scope}");
            }

            metadata[DeploymentMetadata.ResourceGroupKey] = new ObjectExpression(
                [
                    new("id".AsExpression(), arguments.SubscriptionId is not null
                        ? $"/subscriptions/{arguments.SubscriptionId}/resourceGroups/{arguments.ResourceGroup}".AsExpression()
                        : MetadataPlaceholder("resourceGroup", "id")),
                    new("name".AsExpression(), arguments.ResourceGroup.AsExpression()),
                    new("type".AsExpression(), "Microsoft.Resources/resourceGroups".AsExpression()),
                    new("location".AsExpression(), arguments.Location is not null
                        ? arguments.Location.AsExpression()
                        : MetadataPlaceholder("resourceGroup", "location")),
                    new("tags".AsExpression(), MetadataPlaceholder("resourceGroup", "tags")),
                    new("managedBy".AsExpression(), MetadataPlaceholder("resourceGroup", "managedBy")),
                    new("properties".AsExpression(), MetadataPlaceholder("resourceGroup", "properties")),
                ],
                position: null);
        }

        if (arguments.DeploymentName is not null ||
            (arguments.Location is not null && scope is not TemplateDeploymentScope.ResourceGroup))
        {
            Dictionary<ITemplateLanguageExpression, ITemplateLanguageExpression> properties = new()
            {
                {
                    "name".AsExpression(),
                    arguments.DeploymentName?.AsExpression() ?? MetadataPlaceholder("deployment", "name")
                },
                {
                    "properties".AsExpression(),
                    new ObjectExpression(
                        [
                            new("template".AsExpression(), new ObjectExpression(
                                [new("contentVersion".AsExpression(), template.ContentVersion.Value.AsExpression())],
                                position: null))
                        ],
                        position: null)
                },
            };

            if (scope is not TemplateDeploymentScope.ResourceGroup)
            {
                properties["location".AsExpression()] = arguments.Location?.AsExpression()
                    ?? MetadataPlaceholder("deployment", "location");
            }

            metadata[DeploymentMetadata.DeploymentKey] = new ObjectExpression(properties, position: null);
        }

        return metadata;
    }

    private static ITemplateLanguageExpression MetadataPlaceholder(string name, params string[] properties)
        => new FunctionExpression(name, [], [.. properties.Select(p => p.AsExpression())], null, irreducible: true);
}

    public static class JsonElementFactory
    {
        private static readonly JsonDocumentOptions DefaultJsonDocumentOptions = new()
        {
            CommentHandling = JsonCommentHandling.Skip,
        };

        private static readonly JsonSerializerOptions DefaultSerializeOptions = new()
        {
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            Converters = { new JsonStringEnumConverter() },
        };

        public static JsonElement CreateElement(ReadOnlyMemory<byte> utf8Json, JsonDocumentOptions? options = null)
        {
            using var document = JsonDocument.Parse(utf8Json, options ?? DefaultJsonDocumentOptions);

            // JsonDocument is disposed when leaving scope, so we need to clone RootElement.
            // See: https://docs.microsoft.com/en-us/dotnet/standard/serialization/system-text-json-migrate-from-newtonsoft-how-to?pivots=dotnet-5-0#jsondocument-is-idisposable.
            return document.RootElement.Clone();
        }

        public static JsonElement CreateElementFromStream(Stream utf8Json, JsonDocumentOptions? options = null)
        {
            using var document = JsonDocument.Parse(utf8Json, options ?? DefaultJsonDocumentOptions);

            return document.RootElement.Clone();
        }

        public static JsonElement CreateElement(string utf8Json, JsonDocumentOptions? options = null)
        {
            using var document = JsonDocument.Parse(utf8Json, options ?? DefaultJsonDocumentOptions);

            return document.RootElement.Clone();
        }

        public static JsonElement CreateElement<T>(T value, JsonSerializerOptions? options = null)
        {
            if (value is JsonElement element)
            {
                return element;
            }

            var bytes = JsonSerializer.SerializeToUtf8Bytes(value, options ?? DefaultSerializeOptions);

            return CreateElement((ReadOnlyMemory<byte>)bytes);
        }

        public static JsonElement? CreateNullableElement<T>(T? value, JsonSerializerOptions? options = null) =>
            value is not null ? CreateElement(value, options) : null;
    }