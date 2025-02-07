import { useState } from 'react';
import { DotnetInterop } from './interop'
import { Alert, Button, ButtonGroup, Col, Container, Dropdown, Form, FormControl, Nav, Navbar, Table } from 'react-bootstrap'

function App({ interop }: { interop: DotnetInterop }) {
  const [filterText, setFilterText] = useState('');
  const [selectedResource, setSelectedResource] = useState<string>();
  const [template, setTemplate] = useState<string>();
  const [parameters, setParameters] = useState<string>();
  const [metadata, setMetadata] = useState<string>(JSON.stringify({
    'resourceGroup': {
      'id': '/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg1',
      'location': 'eastus',
    }
  }, null, 2));

  const handleTemplateFileChange = async (e: React.ChangeEvent<HTMLInputElement>) =>
    setTemplate(await e.target.files?.item(0)?.text() ?? undefined);

  const handleParametersFileChange = async (e: React.ChangeEvent<HTMLInputElement>) =>
    setParameters(await e.target.files?.item(0)?.text() ?? undefined);

  const templateInfoResult = template ? tryExecute(() => interop.getTemplateInfo({ template })) : undefined;
  const templateError = templateInfoResult?.error ?? templateInfoResult?.value.validationMessage;
  const templateInfo = templateInfoResult?.value;

  const parsedTemplateResult = template ? tryExecute(() => interop.getParsedTemplate({ template, parameters, metadata })) : undefined;
  const expandedTemplate = parsedTemplateResult?.value ? JSON.parse(parsedTemplateResult.value.expandedTemplate) : undefined;
  const resourcesByName = expandedTemplate ? 
    (Array.isArray(expandedTemplate.resources) ? 
    expandedTemplate.resources.reduce((acc: any, cur: any) => ({ ...acc, [cur.name]: cur }), {}) :
      expandedTemplate.resources) :
    {};

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
        <Form.Group className="mb-3">
          <Form.Label>Upload a template file</Form.Label>
          <Form.Control type="file" onChange={handleTemplateFileChange} />
        </Form.Group>
        {templateError &&
          <Alert variant="danger">{templateError}</Alert>
        }
        <Form.Group className="mb-3">
          <Form.Label>Upload a parameters file</Form.Label>
          <Form.Control type="file" onChange={handleParametersFileChange} />
        </Form.Group>
        <Form.Group>
          <Form.Label>Metadata</Form.Label>
          <Form.Control as="textarea" rows={10} value={metadata} onChange={e => setMetadata(e.currentTarget.value)} />
        </Form.Group>
      </Container>
      <Container>
        <Table bordered>
          <tbody>
            {templateInfo?.templateHash &&
              <tr>
                <td>Template Hash</td>
                <td>{templateInfo.templateHash}</td>
              </tr>
            }
            {parsedTemplateResult?.value?.parametersHash &&
              <tr>
                <td>Parameters Hash</td>
                <td>{parsedTemplateResult.value.parametersHash}</td>
              </tr>
            }
            {templateInfo?.generatorName &&
              <tr>
                <td>Generator Name</td>
                <td>{templateInfo.generatorName}</td>
              </tr>
            }
            {templateInfo?.generatorVersion &&
              <tr>
                <td>Generator Version</td>
                <td>{templateInfo.generatorVersion}</td>
              </tr>
            }
            {templateInfo?.validationMessage &&
              <tr>
                <td>Validation Message</td>
                <td>{templateInfo.validationMessage}</td>
              </tr>
            }
          </tbody>
        </Table>
      </Container>
      {parsedTemplateResult?.error &&
        <Alert variant="danger">{parsedTemplateResult.error}</Alert>
      }
      {Object.keys(resourcesByName).length > 0 && <Container>
        <Dropdown as={ButtonGroup} onSelect={key => key ? setSelectedResource(key) : setSelectedResource(undefined)} onToggle={() => setFilterText('')}>
        <Dropdown.Toggle as={Button} size="sm" variant="primary" className="mx-1">View Resource</Dropdown.Toggle>
        <Dropdown.Menu>
          <Col>
            <FormControl
              placeholder="Type to filter..."
              onChange={(e) => setFilterText(e.target.value)}
              value={filterText} />
          </Col>
          {Object.keys(resourcesByName).map(key => 
            <Dropdown.Item key={key} eventKey={key} active={false}>{key}</Dropdown.Item>)}
        </Dropdown.Menu>
        </Dropdown>
        {selectedResource && resourcesByName[selectedResource] && <code>
          <pre>
            {JSON.stringify(resourcesByName[selectedResource], null, 2)}
          </pre>
        </code> }
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