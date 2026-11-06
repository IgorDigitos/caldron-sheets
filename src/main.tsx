import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app';
import { RepositorioDexie } from './dados/dexie';
import './styles.css';

registerSW({ immediate: true });

render(<App repo={new RepositorioDexie()} />, document.getElementById('app')!);
