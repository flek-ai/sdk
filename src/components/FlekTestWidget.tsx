import * as React from "react";
import { ErrorBoundary } from "react-error-boundary";

import { FlekTestWidgetOptions, FlekTestWidgetSource } from "../@types";
import { useForceUpdate } from "../hooks";

export type FlekTestWidgetProps = {
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

export default function FlekTestWidget({
  source,
  renderLoading = () => <React.Fragment />,
  renderError = () => <React.Fragment />,
  dangerouslySetInnerJSX = false,
  onError = console.error,
  shouldOpenFlekTestWidget,
  ...extras
}: FlekTestWidgetProps): JSX.Element {
  const { forceUpdate } = useForceUpdate();
  const [Component, setComponent] = React.useState<React.Component | null>(
    null
  );
  const [error, setError] = React.useState<Error | null>(null);
  React.useEffect(() => {
    (async () => {
      try {
        if (typeof shouldOpenFlekTestWidget === "function") {
          const Component = await shouldOpenFlekTestWidget(source, {
            dangerouslySetInnerJSX,
          });
          return setComponent(() => Component);
        }
        throw new Error(
          `[FlekTestWidget]: Expected function shouldOpenFlekTestWidget, encountered ${typeof shouldOpenFlekTestWidget}.`
        );
      } catch (e) {
        setComponent(() => null);
        setError(e as Error);
        onError(e as Error);
        return forceUpdate();
      }
    })();
  }, [
    shouldOpenFlekTestWidget,
    source,
    setComponent,
    forceUpdate,
    setError,
    dangerouslySetInnerJSX,
    onError,
  ]);
  const FallbackComponent = React.useCallback((): JSX.Element => {
    return renderError({
      error: new Error("[FlekTestWidget]: Failed to render."),
    });
  }, [renderError]);

  if (typeof Component === "function") {
    return (
      <ErrorBoundary FallbackComponent={FallbackComponent}>
        {/* @ts-ignore */}
        <Component {...extras} />
      </ErrorBoundary>
    );
  } else if (error) {
    return renderError({ error });
  }
  return renderLoading();
}
