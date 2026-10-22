import jaguar from './profiles/jaguarxkjss.json';
import furari from './profiles/furari-488.json';
import nuvolari from './profiles/nuvolari.json';
import tesla from './profiles/tesla1.json';
import chiron from './profiles/buggati.json';
import bentley from './profiles/bentley-gt.json';
import bmw from './profiles/bmw1.json';
import av12 from './profiles/av12.json';
import mp1x from './profiles/mp1x.json';
import mustang from './profiles/mustang.json';
import porsche1 from './profiles/porsche1.json';
import valkyrie from './profiles/aston-martin-valk.json';

export const VEHICLES={'furari-488':furari,jaguarxkjss:jaguar,nuvolari,tesla1:tesla,buggati:chiron,'bentley-gt':bentley,bmw1:bmw,av12,mp1x,mustang,porsche1,'aston-martin-valk':valkyrie};
export const vehicleKey=value=>Object.hasOwn(VEHICLES,value)?value:'av12';
