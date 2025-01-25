type GetTemplateMetadataRequest = {
  template: string;
}

type GetTemplateMetadataResponse = {
  templateHash?: string;
  generatorName?: string;
  generatorVersion?: string;
  validationMessage?: string;
}

export interface DotnetInterop {
  getTemplateMetadata(request: GetTemplateMetadataRequest): GetTemplateMetadataResponse;
}

function wrapInteropMethod<TIn, TOut>(interop: any, methodName: string): (arg: TIn) => TOut {
  return (arg: TIn) => interop.invokeMethod(methodName, arg);
}

function getDotnetInterop(interop: any): DotnetInterop {
  return {
    getTemplateMetadata: wrapInteropMethod<GetTemplateMetadataRequest, GetTemplateMetadataResponse>(interop, 'GetTemplateMetadata'),
  }
}

export function initializeInterop(self: any) {
  return new Promise<DotnetInterop>((resolve, _) => {
    self['InteropInitialize'] = (newInterop: any) => {
      resolve(getDotnetInterop(newInterop));
    }

    // this is necessary to invoke the Blazor startup code - do not remove it!
    const s = document.createElement('script');
    s.setAttribute('src', '_framework/blazor.webassembly.js');
    document.body.appendChild(s);
  });
}