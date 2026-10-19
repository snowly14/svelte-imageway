/** Import responsive local assets through the Imageway Vite plugin. */
declare module '*?img' {
  const image: import('./core/types.js').ImageArtifact;
  export default image;
}
declare module '*&img' {
  const image: import('./core/types.js').ImageArtifact;
  export default image;
}
