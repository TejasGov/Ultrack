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
  jaguarxkjss:['tyre','crbnfibre'],
};
export function isModelRim(key,name='') {return RIMS[key]?.includes(name.replace(/^[^|]*\|/,''))??false;}
