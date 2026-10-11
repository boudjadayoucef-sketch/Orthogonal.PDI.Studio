/// <reference types="vite/client" />

// PATCH 017H : CSS importes en chaine de caracteres (embarques dans le bundle).
declare module "*.css?inline" {
  const css: string;
  export default css;
}

declare module "*.jpg" {
  const value: string;
  export default value;
}

declare module "*.png" {
  const value: string;
  export default value;
}

declare module "*.svg" {
  const value: string;
  export default value;
}

declare module "*.jpeg" {
  const value: string;
  export default value;
}
