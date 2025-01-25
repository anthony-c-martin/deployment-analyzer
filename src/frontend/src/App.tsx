import { DotnetInterop } from './interop'
import { Alert, Container, Nav, Navbar } from 'react-bootstrap'

function App({ interop }: { interop: DotnetInterop }) {
  const hi = interop.sayHi('Dotnet');

  return (
    <>
    <Navbar bg="dark" variant="dark">
    <Container>
      <Navbar.Brand>Deployment Analyzer</Navbar.Brand>
      <Nav className="ms-auto">
      </Nav>
      </Container>
    </Navbar>
    <Container>
      <Alert>{hi}</Alert>
    </Container>
    </>
  )
}

export default App
