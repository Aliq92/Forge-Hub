import { initSettingsOnly } from './state.js';
import { mount } from './ui.js';

initSettingsOnly();

const root = document.getElementById('app');
mount(root);
