using Microsoft.JSInterop;

namespace DeploymentAnalyzer;

public class Interop
{
    [JSInvokable]
    public string SayHi(string name)
    {
        return $"Hello, {name}!";
    }
}