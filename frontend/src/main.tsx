import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css';
import App from './App.tsx'
import { initializeInterop } from './interop.ts'
import { Spinner } from 'react-bootstrap'

const rootElement = createRoot(document.getElementById('root')!);

rootElement.render(<Spinner animation="border" role="status"/>);

initializeInterop(window).then(interop => {
  rootElement.render(
    <StrictMode>
      <App interop={interop} />
    </StrictMode>
  )
});