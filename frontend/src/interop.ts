type GetTemplateInfoRequest = {
  template: string;
}

type GetTemplateInfoResponse = {
  templateHash?: string;
  generatorName?: string;
  generatorVersion?: string;
  validationMessage?: string;
}

type GetParsedTemplateRequest = {
  template: string;
  parameters?: string;
  metadata: string;
}

type GetParsedTemplateResponse = {
  expandedTemplate: string;
  parametersHash: string;
}

export interface DotnetInterop {
  getTemplateInfo(request: GetTemplateInfoRequest): GetTemplateInfoResponse;
  getParsedTemplate(request: GetParsedTemplateRequest): GetParsedTemplateResponse;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function invokeMethod(interop: any, methodName: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (arg: any) => {
    try {
      return interop.invokeMethod(methodName, arg);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      if (e.message && e.stack) {
        throw `Managed Exception: ${e.message}\n${e.stack}`;
      }

      throw e;
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDotnetInterop(interop: any): DotnetInterop {
  return {
    getTemplateInfo: invokeMethod(interop, "GetTemplateInfo"),
    getParsedTemplate: invokeMethod(interop, "GetParsedTemplate"),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function initializeInterop(self: any) {
  return new Promise<DotnetInterop>((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    self['InteropInitialize'] = (newInterop: any) => {
      resolve(getDotnetInterop(newInterop));
    }

    // this is necessary to invoke the Blazor startup code - do not remove it!
    const s = document.createElement('script');
    s.setAttribute('src', '_framework/blazor.webassembly.js');
    document.body.appendChild(s);
  });
}