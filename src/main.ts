import { startExperience } from './experience';
import './style.css';
import { mountHud } from './ui';

const canvas = document.querySelector<HTMLCanvasElement>('#view');
if (!canvas) throw new Error('Missing canvas');

const hud = mountHud();
startExperience(canvas, hud);
