using Microsoft.VisualStudio.TestTools.UnitTesting;
using FluentAssertions;
using TestHelpers;
using System.Reflection;

namespace DeploymentAnalyzer.Tests;

[TestClass]
public class InteropTests
{
    [TestMethod]
    public void GetTemplateInfo_returns_metadata()
    {
        var templateFile = new EmbeddedFile(Assembly.GetExecutingAssembly(), "Files/ds.json");

        var interop = new Interop();
        var result = interop.GetTemplateInfo(new(
            Template: templateFile.Contents!));

        result.TemplateHash.Should().Be("785693713731518109");
        result.GeneratorName.Should().Be("bicep");
        result.GeneratorVersion.Should().Be("0.32.4.45862");
    }

    [TestMethod]
    public void GetParsedTemplate_returns_expanded_template()
    {
        var templateFile = new EmbeddedFile(Assembly.GetExecutingAssembly(), "Files/ds.json");
        var parametersFile = new EmbeddedFile(Assembly.GetExecutingAssembly(), "Files/ds.parameters.json");

        var interop = new Interop();
        var result = interop.GetParsedTemplate(new(
            Template: templateFile.Contents!,
            Parameters: parametersFile.Contents!,
            Metadata: "{}"));

        result.ExpandedTemplate.Should().NotBeNull();
        result.ParmetersHash.Should().Be("8013686910464437545");
    }
}