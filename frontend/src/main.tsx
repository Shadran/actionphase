// Polyfill for iOS 15 named capture group support
if (typeof navigator !== 'undefined') {
    try {
        new RegExp('(?<test>a)');
    } catch {
        // Named capture groups not supported — patch RegExp constructor
        const OriginalRegExp = RegExp;
        // @ts-expect-error Weird hacky workaround
        window.RegExp = function PatchedRegExp(pattern: string | RegExp, flags?: string) {
            if (typeof pattern === 'string') {
                pattern = pattern.replace(/\(\?<([^>]+)>/g, '(?:');
            }
            return new OriginalRegExp(pattern, flags);
        };
        // @ts-expect-error Weird hacky workaround
        window.RegExp.prototype = OriginalRegExp.prototype;
    }
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/datepicker.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
