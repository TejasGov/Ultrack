// Wheel-only material selectors; never recolor a shared body/carbon material globally.
const RIMS={
  av12:['Carbon','Hubcap'],
  'furari-488':['M_Rim_Main_SetPT_Max.002'],
  mp1x:['rims'],
  bmw1:['wheel'],
  jaguarxkjss:['tyre','crbnfibre'],
  nuvolari:['gt:Vehicle_Exterior_mm_wheel_009'],
};
export function isModelRim(key,name='') {return RIMS[key]?.includes(name.replace(/^[^|]*\|/,''))??false;}
