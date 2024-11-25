need to fix ts build

node_modules/@types/react-native/node_modules/@types/react/index.d.ts:3208:13 - error TS2717: Subsequent property declarations must have the same type.  Property 'h1' must be of type 'DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>', but here has type 'DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>'.

3208             h1: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
                 ~~

  node_modules/@types/react/index.d.ts:3204:13
    3204             h1: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
                     ~~
    'h1' was also declared here.


this error for 200 times for each react types

Fix this

