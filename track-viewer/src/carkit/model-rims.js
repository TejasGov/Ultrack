// Wheel-only material selectors; never recolor a shared body/carbon material globally.
const RIMS={
  av12:['Carbon','Hubcap'],
  'furari-488':['M_Rim_Main_SetPT_Max.002'],
  mp1x:['rims'],
  bmw1:['wheel'],
  'nissan-z':['mm_wheel'],
  supra:['material_13'],
  jesko:['CARBON'],
  'ford-gt':['rimpaint'],
  zr1:['rimpaint'],
  jaguarxkjss:['tyre','crbnfibre'],
};
/** whether the car's rims take a paint colour: car-lab wheels always do (their rim is m.rim); a model's own wheel material is kept unless it is listed here (the CC850 shares one with its tyres and discs) */
export const paintsRims = (key, isModel) => !isModel || key in RIMS;
export function isModelRim(key,name='') {return RIMS[key]?.includes(name.replace(/^[^|]*\|/,''))??false;}
