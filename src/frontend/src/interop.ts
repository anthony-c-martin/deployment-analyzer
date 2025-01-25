export interface DotnetInterop {
  sayHi(name: string): string;
}

function wrapInteropMethod<TIn, TOut>(interop: any, methodName: string): (arg: TIn) => TOut {
  return (arg: TIn) => interop.invokeMethod(methodName, arg);
}

function getDotnetInterop(interop: any): DotnetInterop {
  return {
    sayHi: wrapInteropMethod<string, string>(interop, 'SayHi'),
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