// Original IdeaRoute assets, variant 3 in brand-assets.
export function LogoMark({size = 32}: {size?: number}) {
  return <span className="ir-logo-mark" style={{width:size,height:size}} aria-hidden="true">
    <img className="ir-logo-light" src="/brand/icon-light.svg" width={size} height={size} alt=""/>
    <img className="ir-logo-dark" src="/brand/icon-dark.svg" width={size} height={size} alt=""/>
  </span>
}
