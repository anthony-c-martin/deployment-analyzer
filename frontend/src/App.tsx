import { useState } from 'react';
import { DotnetInterop } from './interop'
import { Alert, Container, Form, Nav, Navbar, Table } from 'react-bootstrap'

function App({ interop }: { interop: DotnetInterop }) {
  const [template, setTemplate] = useState<string>();
  const [parameters, setParameters] = useState<string>();

  const handleTemplateFileChange = async (e: React.ChangeEvent<HTMLInputElement>) =>
    setTemplate(await e.target.files?.item(0)?.text() ?? undefined);

  const handleParametersFileChange = async (e: React.ChangeEvent<HTMLInputElement>) =>
    setParameters(await e.target.files?.item(0)?.text() ?? undefined);

  const metadataResult = template ? tryExecute(() => interop.getTemplateMetadata({ template })) : undefined;
  const templateError = metadataResult?.error ?? metadataResult?.value.validationMessage;
  const metadata = metadataResult?.value;

  const parsedTemplateResult = template ? tryExecute(() => interop.getParsedTemplate({ template, parameters })) : undefined;
  const expandedTemplate = parsedTemplateResult?.value ? JSON.parse(parsedTemplateResult.value.expandedTemplate) : undefined;

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
        <Form.Group controlId="formFile" className="mb-3">
          <Form.Label>Upload a template file</Form.Label>
          <Form.Control type="file" onChange={handleTemplateFileChange} />
        </Form.Group>
        {templateError &&
          <Alert variant="danger">{templateError}</Alert>
        }
        <Form.Group controlId="formFile" className="mb-3">
          <Form.Label>Upload a parameters file</Form.Label>
          <Form.Control type="file" onChange={handleParametersFileChange} />
        </Form.Group>
      </Container>
      <Container>
        <Table bordered>
          <tbody>
            {metadata?.templateHash &&
              <tr>
                <td>Template Hash</td>
                <td>{metadata.templateHash}</td>
              </tr>
            }
            {parsedTemplateResult?.value?.parametersHash &&
              <tr>
                <td>Parameters Hash</td>
                <td>{parsedTemplateResult.value.parametersHash}</td>
              </tr>
            }
            {metadata?.generatorName &&
              <tr>
                <td>Generator Name</td>
                <td>{metadata.generatorName}</td>
              </tr>
            }
            {metadata?.generatorVersion &&
              <tr>
                <td>Generator Version</td>
                <td>{metadata.generatorVersion}</td>
              </tr>
            }
            {metadata?.validationMessage &&
              <tr>
                <td>Validation Message</td>
                <td>{metadata.validationMessage}</td>
              </tr>
            }
          </tbody>
        </Table>
      </Container>
      {parsedTemplateResult?.error &&
        <Alert variant="danger">{parsedTemplateResult.error}</Alert>
      }
      {expandedTemplate &&
      <Container>
        <code>
          <pre>
            {JSON.stringify(expandedTemplate, null, 2)}
          </pre>
        </code>
      </Container>
      }
    </>
  )
}

export default App

function tryExecute<T>(func: () => T) {
  try {
    return { value: func() };
  } catch (e) {
    return { error: `${e}`};
  }
}