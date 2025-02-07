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

function invokeMethod(interop: any, methodName: string) {
  return (arg: any) => {
    try {
      return interop.invokeMethod(methodName, arg);
    } catch (e: any) {
      if (e.message && e.stack) {
        throw `Managed Exception: ${e.message}\n${e.stack}`;
      }

      throw e;
    }
  }
}

function getDotnetInterop(interop: any): DotnetInterop {
  return {
    getTemplateInfo: invokeMethod(interop, "GetTemplateInfo"),
    getParsedTemplate: invokeMethod(interop, "GetParsedTemplate"),
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