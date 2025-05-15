import { useEffect, useState } from 'react';
import { DotnetInterop, GetParsedTemplateResponse } from './interop'
import { Alert, Button, ButtonGroup, Col, Container, Dropdown, Form, FormControl, Nav, Navbar, Row, Table } from 'react-bootstrap'
import { Github } from 'react-bootstrap-icons';

type Metadata = {
  tenantId: string;
  subscriptionId: string;
  resourceGroup: string;
  location: string;
  deploymentName: string;
};

function App({ interop }: { interop: DotnetInterop }) {
  const [filterText, setFilterText] = useState('');
  const [selectedResource, setSelectedResource] = useState<string>();
  const [template, setTemplate] = useState<string>();
  const [parameters, setParameters] = useState<string>();
  const [metadata, setMetadata] = useState<Metadata>({
    tenantId: '00000000-0000-0000-0000-000000000000',
    subscriptionId: '00000000-0000-0000-0000-000000000000',
    resourceGroup: 'myResourceGroup',
    location: 'eastus',
    deploymentName: 'myDeployment'
  });

  const [parseResult, setParseResult] = useState<GetParsedTemplateResponse>();
  const [parseError, setParseError] = useState<string>();

  const handleTemplateFileChange = async (e: React.ChangeEvent<HTMLInputElement>) =>
    setTemplate(await e.target.files?.item(0)?.text() ?? undefined);

  const handleParametersFileChange = async (e: React.ChangeEvent<HTMLInputElement>) =>
    setParameters(await e.target.files?.item(0)?.text() ?? undefined);

  const templateInfoResult = template ? tryExecute(() => interop.getTemplateInfo({ template })) : undefined;
  const templateError = templateInfoResult?.error ?? templateInfoResult?.value.validationMessage;
  const templateInfo = templateInfoResult?.value;

  useEffect(() => {
    const update = async () => {
      if (!template) {
        setParseResult(undefined);
        setParseError(undefined);
        return;
      }

      try {
        const parseResult = await interop.getParsedTemplate({ template, parameters, metadata });
        setParseResult(parseResult);
        setParseError(undefined);
      } catch (e) {
        setParseResult(undefined);
        setParseError(`${e}`);
      }
    };

    update();
  }, [template, parameters, metadata]);

  const resourcesByName = parseResult?.predictedResources.reduce((acc: any, cur: any) => ({ ...acc, [cur.name]: cur }), {}) ?? {};

  return (
    <>
      <Navbar bg="dark" variant="dark">
        <Container>
          <Navbar.Brand>Deployment Analyzer</Navbar.Brand>
          <Nav.Item className="ml-auto">
            <Nav.Link href="https://github.com/anthony-c-martin/deployment-analyzer">
              <Button variant="secondary"><Github/></Button>
            </Nav.Link>
          </Nav.Item>
        </Container>
      </Navbar>
      <Container fluid>
        <Row>
          <Col xs={4}>
            <Row className='py-2'>
              <h3>Inputs</h3>
              <Form.Group className="mb-3">
                <Form.Label>Upload a template file</Form.Label>
                <Form.Control type="file" onChange={handleTemplateFileChange} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Upload a parameters file</Form.Label>
                <Form.Control type="file" onChange={handleParametersFileChange} />
              </Form.Group>
            </Row>
            <Row className='py-2'>
              <h3>Metadata</h3>
              <Form.Group className="mb-3">
                <Form.Label>Tenant Id</Form.Label>
                <Form.Control value={metadata.tenantId} onChange={e => setMetadata({ ...metadata, tenantId: e.currentTarget.value })} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Subscription Id</Form.Label>
                <Form.Control value={metadata.subscriptionId} onChange={e => setMetadata({ ...metadata, subscriptionId: e.currentTarget.value })} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Resource Group</Form.Label>
                <Form.Control value={metadata.resourceGroup} onChange={e => setMetadata({ ...metadata, resourceGroup: e.currentTarget.value })} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Location</Form.Label>
                <Form.Control value={metadata.location} onChange={e => setMetadata({ ...metadata, location: e.currentTarget.value })} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Deployment Name</Form.Label>
                <Form.Control value={metadata.deploymentName} onChange={e => setMetadata({ ...metadata, deploymentName: e.currentTarget.value })} />
              </Form.Group>
            </Row>
          </Col>
          <Col xs={8}>
            <Row className='py-2'>
              <h3>Template Info</h3>
              <Table bordered>
                <tbody>
                  {templateInfo?.templateHash &&
                    <tr>
                      <td>Template Hash</td>
                      <td>{templateInfo.templateHash}</td>
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
            </Row>
            {Object.keys(resourcesByName).length > 0 && <Row className='py-2'>
              <h3>Resources</h3>
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
              </code>}
            </Row>}
          </Col>
        </Row>
        {templateError &&
          <Row>
            <Alert variant="danger"><code>{templateError}</code></Alert>
          </Row>
        }
        {parseError &&
          <Row>
            <Alert variant="danger"><code>{parseError}</code></Alert>
          </Row>
        }
        {parseResult && parseResult.diagnostics.length > 0 &&
          <Row>
            {parseResult.diagnostics.map((d, i) => 
              <Alert key={i} variant="warning"><code>{d}</code></Alert>)}
          </Row>
        }
      </Container>
    </>
  )
}

export default App

function tryExecute<T>(func: () => T) {
  try {
    return { value: func() };
  } catch (e) {
    return { error: `${e}` };
  }
}