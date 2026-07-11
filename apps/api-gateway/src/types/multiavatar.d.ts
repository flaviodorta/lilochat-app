declare module '@multiavatar/multiavatar' {
  /** Official Multiavatar generator — same 12B avatars as api.multiavatar.com, locally. */
  function multiavatar(seed: string, sansEnv?: boolean): string;
  export default multiavatar;
}
