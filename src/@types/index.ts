import { AxiosPromise, AxiosRequestConfig, AxiosResponse } from 'axios';

export type PromiseCallback<T> = {
  readonly resolve: (result: T) => void;
  readonly reject: (error: Error) => void;
};

export type FlekTestWidgetSource = {
  readonly uri: string;
} | string;

export type FlekTestWidgetComponentCache = {
  readonly [uri: string]: React.Component | null;
};

export type FlekTestWidgetTasks = {
  readonly [uri: string]: PromiseCallback<React.Component>[];
};

export type FlekTestWidgetOptions = {
  readonly dangerouslySetInnerJSX: boolean;
};

export type FlekTestWidgetContextConfig = {
  readonly verify: (response: AxiosResponse<string>) => Promise<boolean>;
  readonly buildRequestForUri?: (config: AxiosRequestConfig) => AxiosPromise<string>;
  readonly global?: any;
};
