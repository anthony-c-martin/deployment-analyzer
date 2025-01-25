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

namespace DeploymentAnalyzer;

public class Interop
{
    public record GetTemplateMetadataRequest(
        string Template);

    public record GetTemplateMetadataResponse(
        string? TemplateHash,
        string? GeneratorName,
        string? GeneratorVersion,
        string? ValidationMessage);

    [JSInvokable]
    public GetTemplateMetadataResponse GetTemplateMetadata(GetTemplateMetadataRequest request)
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
        string? Parameters);

    public record GetParsedTemplateResponse(
        string ExpandedTemplate,
        string ParmetersHash);

    [JSInvokable]
    public GetParsedTemplateResponse GetParsedTemplate(GetParsedTemplateRequest request)
    {
        var template = TemplateEngine.ParseTemplate(request.Template);

        Dictionary<string, ITemplateLanguageExpression> parametersDictionary = [];
        if (request.Parameters?.TryFromJson<DeploymentParametersDefinition>() is {} parametersDefinition)
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
            metadata: new InsensitiveDictionary<ITemplateLanguageExpression>() {
                /*
                [DeploymentMetadata.TenantKey] = new UnevaluableExpression(null),
                [DeploymentMetadata.ManagementGroupKey] = new UnevaluableExpression(null),
                [DeploymentMetadata.SubscriptionKey] = new UnevaluableExpression(null),
                [DeploymentMetadata.ResourceGroupKey] = new UnevaluableExpression(null),
                [DeploymentMetadata.DeploymentKey] = new UnevaluableExpression(null),
                [DeploymentMetadata.DeployerKey] = new UnevaluableExpression(null),
                [DeploymentMetadata.EnvironmentKey] = new UnevaluableExpression(null),
                [DeploymentMetadata.ProvidersKey] = new UnevaluableExpression(null),
                */
            },
            metricsRecorder: null);

        var expandedTemplate = reduced.AsTemplate();
        var parametersHash = TemplateHelpers.ComputeParametersHash(expandedTemplate.ToJToken());

        return new(
            expandedTemplate.ToJson(),
            parametersHash);
    }
}