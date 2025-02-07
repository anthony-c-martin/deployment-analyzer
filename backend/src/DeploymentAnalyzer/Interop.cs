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
using Microsoft.WindowsAzure.ResourceStack.Common.Collections;
using Newtonsoft.Json.Linq;

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

    public record GetParsedTemplateRequest(
        string Template,
        string Metadata,
        string? Parameters);

    public record GetParsedTemplateResponse(
        string ExpandedTemplate,
        string ParmetersHash);

    [JSInvokable]
    public GetParsedTemplateResponse GetParsedTemplate(GetParsedTemplateRequest request)
    {
        var template = TemplateEngine.ParseTemplate(request.Template);
        var metadata = ParseMetadata(request.Metadata);

        Dictionary<string, ITemplateLanguageExpression> parametersDictionary = [];
        if (request.Parameters?.TryFromJson<DeploymentParametersDefinition>() is { } parametersDefinition)
        {
            parametersDictionary = parametersDefinition.Parameters.ToDictionary(x => x.Key, x => JTokenConverter.ConvertToLanguageExpression(x.Value.Value));
        }

        var reduced = TemplateEngine.ReduceTemplateLanguageExpressions(
            managementGroupName: null,
            subscriptionId: null,
            resourceGroupName: null,
            template: template,
            apiVersion: new StringExpression(CoreConstants.ApiVersion20240701, null),
            suppliedParameterValues: parametersDictionary,
            parameterValuesPositionalMetadata: null,
            metadata: metadata,
            metricsRecorder: null);

        var expandedTemplate = reduced.AsTemplate();
        var parametersHash = TemplateHelpers.ComputeParametersHash(expandedTemplate.ToJToken());

        return new(
            expandedTemplate.ToJson(),
            parametersHash);
    }

    private static InsensitiveDictionary<ITemplateLanguageExpression> ParseMetadata(string metadata)
    {
        var metadataDict = metadata.FromJson<InsensitiveDictionary<JToken>>();
        var response = new InsensitiveDictionary<ITemplateLanguageExpression>();
        void AddIfPresent(string key)
        {
            if (metadataDict.TryGetValue(key, out var value))
            {
                response[key] = ExpressionParser.ParseLanguageExpression(value);
            }
        }

        AddIfPresent(DeploymentMetadata.TenantKey);
        AddIfPresent(DeploymentMetadata.ManagementGroupKey);
        AddIfPresent(DeploymentMetadata.SubscriptionKey);
        AddIfPresent(DeploymentMetadata.ResourceGroupKey);
        AddIfPresent(DeploymentMetadata.DeploymentKey);
        AddIfPresent(DeploymentMetadata.DeployerKey);
        AddIfPresent(DeploymentMetadata.EnvironmentKey);
        AddIfPresent(DeploymentMetadata.ProvidersKey);

        return response;
    }
}