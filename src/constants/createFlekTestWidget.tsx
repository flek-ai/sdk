import * as React from 'react';
import axios, { AxiosPromise, AxiosRequestConfig, AxiosResponse } from 'axios';

import {
  PromiseCallback,
  FlekTestWidgetContextConfig,
  FlekTestWidgetSource,
  FlekTestWidgetOptions,
  FlekTestWidgetComponentCache,
  FlekTestWidgetTasks,
} from '../@types';

import { FlekTestWidget as BaseFlekTestWidget } from '../components';

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

const globalName = '__FLEKTESTWIDGET__';

const defaultGlobal = Object.freeze({
  require: (moduleId: string) => {
    if (moduleId === 'react') {
      // @ts-ignore
      return require('react');
    } else if (moduleId === 'react-native') {
      // @ts-ignore
      return require('react-native');
    }
    return null;
  },
});

const buildCompletionHandler = (
  cache: FlekTestWidgetComponentCache,
  tasks: FlekTestWidgetTasks,
) => (uri: string, error?: Error): void => {
  const { [uri]: maybeComponent } = cache;
  const { [uri]: callbacks } = tasks;
  Object.assign(tasks, { [uri]: null });
  callbacks.forEach(({ resolve, reject }) => {
    if (!!maybeComponent) {
      return resolve(maybeComponent);
    }
    return reject(
      error || new Error(`[FlekTestWidget]: Failed to allocate for uri "${uri}".`)
    );
  });
};

const buildCreateComponent = (
  global: any
) => async (src: string): Promise<React.Component> => {
  const Component = await new Function(
    globalName,
    `${Object.keys(global).map((key) => `var ${key} = ${globalName}.${key};`).join('\n')}; const exports = {}; ${src}; return exports.default;`
  )(global);
  if (typeof Component !== 'function') {
    throw new Error(
      `[FlekTestWidget]: Expected function, encountered ${typeof Component}. Did you forget to mark your FlekTestWidget as a default export?`
    );
  }
  return Component;
};

const buildRequestOpenUri = ({
  cache,
  buildRequestForUri,
  verify,
  shouldCreateComponent,
  shouldComplete,
}: {
  readonly cache: FlekTestWidgetComponentCache,
  readonly buildRequestForUri: (config: AxiosRequestConfig) => AxiosPromise<string>;
  readonly verify: (response: AxiosResponse<string>) => Promise<boolean>;
  readonly shouldCreateComponent: (src: string) => Promise<React.Component>;
  readonly shouldComplete: (uri: string, error?: Error) => void;
}) => async (uri: string) => {
  try {
    const result = await buildRequestForUri({
      url: uri,
      method: 'get',
    });
    const { data } = result;
    if (typeof data !== 'string') {
      throw new Error(`[FlekTestWidget]: Expected string data, encountered ${typeof data}.`);
    }
    if (await verify(result) !== true) {
      throw new Error(`[FlekTestWidget]: Failed to verify "${uri}".`);
    }
    const Component = await shouldCreateComponent(data);
    Object.assign(cache, { [uri]: Component });
    return shouldComplete(uri);
  } catch (e: unknown) {
    Object.assign(cache, { [uri]: null });
    if (e instanceof Error && typeof e.message === 'string') {
      return shouldComplete(uri, new Error(e.message));
    } else if (e instanceof Error && typeof e.message === 'string') {
      return shouldComplete(uri, new Error(`${e.message}`));
    }
    return shouldComplete(uri, e as Error);
  }
};

const buildOpenUri = ({
  cache,
  tasks,
  shouldRequestOpenUri,
}: {
  readonly cache: FlekTestWidgetComponentCache;
  readonly tasks: FlekTestWidgetTasks;
  readonly shouldRequestOpenUri: (uri: string) => void;
}) => (uri: string, callback: PromiseCallback<React.Component>): void => {
  const { [uri]: Component } = cache;
  const { resolve, reject } = callback;
  if (Component === null) {
    return reject(
      new Error(`[FlekTestWidget]: Component at uri "${uri}" could not be instantiated.`)
    );
  } else if (typeof Component === 'function') {
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

const buildOpenString = ({
  shouldCreateComponent,
}: {
  readonly shouldCreateComponent: (src: string) => Promise<React.Component>;
}) => async (src: string) => {
  return shouldCreateComponent(src);
};

const buildOpenFlekTestWidget = ({
  shouldOpenString,
  shouldOpenUri,
}: {
  readonly shouldOpenString: (src: string) => Promise<React.Component>;
  readonly shouldOpenUri: (
    uri: string,
    callback: PromiseCallback<React.Component>
  ) => void;
}) => async (source: FlekTestWidgetSource, options: FlekTestWidgetOptions): Promise<React.Component> => {
  const { dangerouslySetInnerJSX } = options;
  if (typeof source === 'string') {
    if (dangerouslySetInnerJSX === true) {
      return shouldOpenString(source as string);
    }
    throw new Error(
      `[FlekTestWidget]: Attempted to instantiate a FlekTestWidget using a string, but dangerouslySetInnerJSX was not true.`
    );
  } else if (source && typeof source === 'object') {
    const uri = "http://192.168.0.154:3000/__mocks__/ContentContainerCard.jsx"
    if (typeof uri === 'string') {
      return new Promise<React.Component>(
        (resolve, reject) => shouldOpenUri(uri, { resolve, reject }),
      );
    }
  }
  throw new Error(`[FlekTestWidget]: Expected valid source, encountered ${typeof source}.`);
};

export default function createFlekTestWidget({
  buildRequestForUri = (config: AxiosRequestConfig) => axios(config),
  global = defaultGlobal,
  verify,
}: FlekTestWidgetContextConfig) {
  if (typeof verify !== 'function') {
    throw new Error(
      '[FlekTestWidget]: To create a FlekTestWidget, you **must** pass a verify() function.',
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

  const FlekTestWidget = (props: FlekTestWidgetProps) => (
    <BaseFlekTestWidget {...props} shouldOpenFlekTestWidget={shouldOpenFlekTestWidget} />
  );

  const preload = async (uri: string): Promise<void> => {
    await shouldOpenFlekTestWidget({ uri }, { dangerouslySetInnerJSX: false })
  };

  return Object.freeze({
    FlekTestWidget,
    preload,
  });
}
