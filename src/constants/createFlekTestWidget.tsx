import * as React from "react";
import axios, { AxiosPromise, AxiosRequestConfig, AxiosResponse } from "axios";

import {
  PromiseCallback,
  FlekTestWidgetContextConfig,
  FlekTestWidgetSource,
  FlekTestWidgetOptions,
  FlekTestWidgetComponentCache,
  FlekTestWidgetTasks,
} from "../@types";

import { FlekTestWidget as BaseFlekTestWidget } from "../components";
import { View } from "react-native";

import { captureRef } from "react-native-view-shot";

import { SERVER, SOCKET_SERVER } from "./server";

type FlekTestWidgetProps = {
  readonly source: FlekTestWidgetSource;
  readonly renderLoading?: () => JSX.Element;
  readonly renderError?: (props: { readonly error: Error }) => JSX.Element;
  readonly dangerouslySetInnerJSX?: boolean;
  readonly onError?: (error: Error) => void;
  readonly shouldOpenFlekTestWidget?: (
    source: FlekTestWidgetSource,
    options: FlekTestWidgetOptions
  ) => Promise<React.Component>;
};

const globalName = "__FLEKTESTWIDGET__";

const defaultGlobal = Object.freeze({
  // @ts-ignore
  require: (moduleId: string) => {
    if (moduleId === "react") {
      // @ts-ignore
      return require("react");
    } else if (moduleId === "react-native") {
      // @ts-ignore
      return require("react-native");
    }
    return null;
  },
});

const buildCompletionHandler =
  (cache: FlekTestWidgetComponentCache, tasks: FlekTestWidgetTasks) =>
  (uri: string, error?: Error): void => {
    const { [uri]: maybeComponent } = cache;
    const { [uri]: callbacks } = tasks;
    Object.assign(tasks, { [uri]: null });
    callbacks.forEach(({ resolve, reject }) => {
      if (!!maybeComponent) {
        return resolve(maybeComponent);
      }
      return reject(
        error ||
          new Error(`[FlekTestWidget]: Failed to allocate for uri "${uri}".`)
      );
    });
  };

const buildCreateComponent =
  (global: any) =>
  async (src: string): Promise<React.Component> => {
    const Component = await new Function(
      globalName,
      `${Object.keys(global)
        .map((key) => `var ${key} = ${globalName}.${key};`)
        .join("\n")}; const exports = {}; ${src}; return exports.default;`
    )(global);
    if (typeof Component !== "function") {
      throw new Error(
        `[FlekTestWidget]: Expected function, encountered ${typeof Component}. Did you forget to mark your FlekTestWidget as a default export?`
      );
    }
    return Component;
  };

const buildRequestOpenUri =
  ({
    cache,
    buildRequestForUri,
    verify,
    shouldCreateComponent,
    shouldComplete,
  }: {
    readonly cache: FlekTestWidgetComponentCache;
    readonly buildRequestForUri: (
      config: AxiosRequestConfig
    ) => AxiosPromise<string>;
    readonly verify: (response: AxiosResponse<string>) => Promise<boolean>;
    readonly shouldCreateComponent: (src: string) => Promise<React.Component>;
    readonly shouldComplete: (uri: string, error?: Error) => void;
  }) =>
  async (uri: string) => {
    try {
      const result = await buildRequestForUri({
        url: uri,
        method: "get",
      });
      const { data } = result;
      if (typeof data !== "string") {
        throw new Error(
          `[FlekTestWidget]: Expected string data, encountered ${typeof data}.`
        );
      }
      if ((await verify(result)) !== true) {
        throw new Error(`[FlekTestWidget]: Failed to verify "${uri}".`);
      }
      const Component = await shouldCreateComponent(data);
      Object.assign(cache, { [uri]: Component });
      return shouldComplete(uri);
    } catch (e: unknown) {
      Object.assign(cache, { [uri]: null });
      if (e instanceof Error && typeof e.message === "string") {
        return shouldComplete(uri, new Error(e.message));
      } else if (e instanceof Error && typeof e.message === "string") {
        return shouldComplete(uri, new Error(`${e.message}`));
      }
      return shouldComplete(uri, e as Error);
    }
  };

const buildOpenUri =
  ({
    cache,
    tasks,
    shouldRequestOpenUri,
  }: {
    readonly cache: FlekTestWidgetComponentCache;
    readonly tasks: FlekTestWidgetTasks;
    readonly shouldRequestOpenUri: (uri: string) => void;
  }) =>
  (uri: string, callback: PromiseCallback<React.Component>): void => {
    const { [uri]: Component } = cache;
    const { resolve, reject } = callback;
    if (Component === null) {
      return reject(
        new Error(
          `[FlekTestWidget]: Component at uri "${uri}" could not be instantiated.`
        )
      );
    } else if (typeof Component === "function") {
      return resolve(Component);
    }

    const { [uri]: queue } = tasks;
    if (Array.isArray(queue)) {
      queue.push(callback);
      return;
    }

    Object.assign(tasks, { [uri]: [callback] });

    return shouldRequestOpenUri(uri);
  };

export const buildOpenString =
  ({
    shouldCreateComponent,
  }: {
    readonly shouldCreateComponent: (src: string) => Promise<React.Component>;
  }) =>
  async (src: string) => {
    return shouldCreateComponent(src);
  };

const buildOpenFlekTestWidget =
  ({
    shouldOpenString,
    shouldOpenUri,
  }: {
    readonly shouldOpenString: (src: string) => Promise<React.Component>;
    readonly shouldOpenUri: (
      uri: string,
      callback: PromiseCallback<React.Component>
    ) => void;
  }) =>
  async (
    source: FlekTestWidgetSource,
    options: FlekTestWidgetOptions
  ): Promise<React.Component> => {
    const { dangerouslySetInnerJSX } = options;
    console.log("source", source);
    if (typeof source === "string") {
      if (dangerouslySetInnerJSX === true) {
        return shouldOpenString(source as string);
      }
      throw new Error(
        `[FlekTestWidget]: Attempted to instantiate a FlekTestWidget using a string, but dangerouslySetInnerJSX was not true.`
      );
    } else if (source && typeof source === "object") {
      const uri = source.uri || `${SERVER}/currentWidget`;
      if (typeof uri === "string") {
        return new Promise<React.Component>((resolve, reject) =>
          shouldOpenUri(uri, { resolve, reject })
        );
      }
    }
    throw new Error(
      `[FlekTestWidget]: Expected valid source, encountered ${typeof source}.`
    );
  };

export default function createFlekTestWidget({
  buildRequestForUri = (config: AxiosRequestConfig) => axios(config),
  global = defaultGlobal,
  verify,
}: FlekTestWidgetContextConfig) {
  if (typeof verify !== "function") {
    throw new Error(
      "[FlekTestWidget]: To create a FlekTestWidget, you **must** pass a verify() function."
    );
  }

  const cache: FlekTestWidgetComponentCache = {};
  const tasks: FlekTestWidgetTasks = {};

  const shouldComplete = buildCompletionHandler(cache, tasks);
  const shouldCreateComponent = buildCreateComponent(global);
  const shouldRequestOpenUri = buildRequestOpenUri({
    cache,
    buildRequestForUri,
    verify,
    shouldCreateComponent,
    shouldComplete,
  });
  const shouldOpenUri = buildOpenUri({
    cache,
    tasks,
    shouldRequestOpenUri,
  });
  const shouldOpenString = buildOpenString({
    shouldCreateComponent,
  });

  const shouldOpenFlekTestWidget = buildOpenFlekTestWidget({
    shouldOpenUri,
    shouldOpenString,
  });

  const FlekTestWidget = (props: FlekTestWidgetProps) => {
    const ref = React.useRef(null);
    const [variant, setVariant] = React.useState<string | null>(null);
    const [wsError, setWsError] = React.useState<Error | null>(null);
    const widgetRef = React.useRef(null);

    React.useEffect(() => {
      let ws: WebSocket;
      try {
        ws = new WebSocket(SOCKET_SERVER);

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "variant") {
              setVariant(data.data);
            }
          } catch (err) {
            console.error("Error parsing WebSocket message:", err);
            setWsError(err as Error);
          }
        };

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          setWsError(new Error("WebSocket connection failed"));
        };

        ws.onclose = () => {
          console.log("WebSocket connection closed");
        };
      } catch (err) {
        console.error("Error creating WebSocket:", err);
        setWsError(err as Error);
      }

      return () => {
        if (ws) {
          ws.close();
        }
      };
    }, []);

    React.useEffect(() => {
      if (ref.current && widgetRef.current && variant) {
        // TODO: Make some mechanism to know when the widget is ready, some sort of websocket message
        // that the widget is ready to take a screenshot.
        setTimeout(() => {
          captureRef(ref.current, {
            format: "png",
            result: "data-uri",
          }).then((uri) => {
            axios.post(`${SERVER}/variants/${variant}/image`, {
              imageUri: uri,
            });
          });
        }, 1000);
      }
    }, [ref.current, widgetRef.current, variant]);

    if (wsError && props.renderError) {
      return props.renderError({ error: wsError });
    }

    return (
      <View ref={ref} style={{ backgroundColor: "black" }}>
        <BaseFlekTestWidget
          widgetRef={widgetRef}
          variant={variant}
          {...props}
          shouldOpenFlekTestWidget={shouldOpenFlekTestWidget}
        />
      </View>
    );
  };

  const preload = async (uri: string): Promise<void> => {
    await shouldOpenFlekTestWidget({ uri }, { dangerouslySetInnerJSX: false });
  };

  return Object.freeze({
    FlekTestWidget,
    preload,
  });
}
