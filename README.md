# 🌌 [`@flek-ai/sdk`](http://npmjs.com/package/@flek-ai/sdk)
A `FlekTestWidget` component allows your [⚛️ **React Native**](https://reactnative.dev) application to import a widget on the flek platform and then test and deploy the widget instantly.

🎬 **Watch the Demo!**

### 🚀 Getting Started

1. Create a new app on the flek platform, an app id will be generated
2. Connect the github repo to the flek platform
3. Create a new widget, a widget id will be generated
4. Copy paste the code of the widget into the widget code editor and replace the widget code with `<FlekTestWidget />`
4. Modify the widget using AI prompts and generate the code
5. Instant deploy the widget

Using [**Yarn**](https://yarnpkg.com):

```sh
yarn add @flek-ai/sdk
```

**`app/page.jsx`**:

```javascript
import * as React from 'react';
import { createFlekTestWidget } from '@flek-ai/sdk';

const { FlekTestWidget } = createFlekTestWidget({
  widgetId: yourWidgetId,
  appId: yourAppId,
  verify: async () => true,
});

export default function App() {
  return <FlekTestWidget />;
}
```

That is it! It just takes 2 minutes to get started.