using Microsoft.JSInterop;
using Azure.Deployments.Core.Helpers;
using Azure.Deployments.Templates.Engines;
using Azure.Deployments.Core.Constants;
using Azure.Deployments.Core.Configuration;
using Azure.Deployments.Templates.Exceptions;
using Azure.Deployments.Core.Exceptions;
using Azure.Deployments.Core.Definitions.Schema;
using Azure.Deployments.Expression.Intermediate;
using Azure.Deployments.Templates.ParsedEntities;

namespace DeploymentAnalyzer;

public class Interop
{
    public record GetTemplateMetadataResponse(
        string? TemplateHash,
        string? GeneratorName,
        string? GeneratorVersion,
        string? ValidationMessage);

    public record GetTemplateMetadataRequest(
        string Template);

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
}