// Removed invalid reference to vite/client which caused "Cannot find type definition file" error
// /// <reference types="vite/client" />

// Fix for "Cannot redeclare block-scoped variable 'process'"
// Augment the existing NodeJS.ProcessEnv interface to include API_KEY instead of redeclaring process
declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string;
    [key: string]: string | undefined;
  }
}
