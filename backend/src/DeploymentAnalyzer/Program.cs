using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using Microsoft.JSInterop;
using DeploymentAnalyzer;

var builder = WebAssemblyHostBuilder.CreateDefault(args);

var serviceProvider = builder.Services.BuildServiceProvider();

var jsRuntime = serviceProvider.GetRequiredService<IJSRuntime>();
var interop = new Interop();
await jsRuntime.InvokeAsync<object>("InteropInitialize", DotNetObjectReference.Create(interop));

await builder.Build().RunAsync();