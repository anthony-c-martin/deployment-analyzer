import { useState } from 'react';
import { DotnetInterop } from './interop'
import { Alert, Button, ButtonGroup, Col, Container, Dropdown, Form, FormControl, Nav, Navbar, Row, Table } from 'react-bootstrap'
import { Github } from 'react-bootstrap-icons';

const sampleMetadata = {
  deployment: {
    name: "foo",
  },
  subscription: {
    tenantId: "00000000-0000-0000-0000-000000000000",
    subscriptionId: "00000000-0000-0000-0000-000000000000",
  },
  resourceGroup: {
    id: '/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg1',
    name: 'rg1',
    location: 'eastus',
  },
  environment: {
    name: "AzureCloud",
    gallery: "https://gallery.azure.com/",
    graph: "https://graph.windows.net/",
    portal: "https://portal.azure.com",
    graphAudience: "https://graph.windows.net/",
    activeDirectoryDataLake: "https://datalake.azure.net/",
    batch: "https://batch.core.windows.net/",
    media: "https://rest.media.azure.net",
    sqlManagement: "https://management.core.windows.net:8443/",
    vmImageAliasDoc: "https://raw.githubusercontent.com/Azure/azure-rest-api-specs/master/arm-compute/quickstart-templates/aliases.json",
    resourceManager: "https://management.azure.com/",
    authentication: {
      loginEndpoint: "https://login.microsoftonline.com/",
      audiences: [
        "https://management.core.windows.net/",
        "https://management.azure.com/"
      ],
      tenant: "common",
      identityProvider: "AAD"
    },
    suffixes: {
      acrLoginServer: ".azurecr.io",
      azureDatalakeAnalyticsCatalogAndJob: "azuredatalakeanalytics.net",
      azureDatalakeStoreFileSystem: "azuredatalakestore.net",
      azureFrontDoorEndpointSuffix: "azurefd.net",
      keyvaultDns: ".vault.azure.net",
      sqlServerHostname: ".database.windows.net",
      storage: "core.windows.net"
    }
  }
};

function App({ interop }: { interop: DotnetInterop }) {
  const [filterText, setFilterText] = useState('');
  const [selectedResource, setSelectedResource] = useState<string>();
  const [template, setTemplate] = useState<string>();
  const [parameters, setParameters] = useState<string>();
  const [metadata, setMetadata] = useState<string>(JSON.stringify(sampleMetadata, null, 2));

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expandedTemplate.resources.reduce((acc: any, cur: any) => ({ ...acc, [cur.name]: cur }), {}) :
      expandedTemplate.resources) :
    {};

  const outputsByName: Record<string, { value: unknown }> = expandedTemplate?.outputs ?? {};

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
      <Container>
        <Row className='py-2'>
          <h3>Inputs</h3>
          <Form.Group className="mb-3">
            <Form.Label>Upload a template file</Form.Label>
            <Form.Control type="file" onChange={handleTemplateFileChange} />
          </Form.Group>
          {templateError &&
            <Alert variant="danger"><pre>{templateError}</pre></Alert>
          }
          <Form.Group className="mb-3">
            <Form.Label>Upload a parameters file</Form.Label>
            <Form.Control type="file" onChange={handleParametersFileChange} />
          </Form.Group>
          <Form.Group>
            <Form.Label>Metadata</Form.Label>
            <Form.Control as="textarea" rows={10} value={metadata} onChange={e => setMetadata(e.currentTarget.value)} />
          </Form.Group>
        </Row>
        {parsedTemplateResult?.error &&
          <Row className='py-2'>
            <Alert variant="danger"><pre>{parsedTemplateResult.error}</pre></Alert>
          </Row>
        }
        {parsedTemplateResult?.value && <Row className='py-2'>
          <h3>Template Info</h3>
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
        </Row>}
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
        {Object.keys(outputsByName).length > 0 && <Row className='py-2'>
          <h3>Outputs</h3>
          <Table bordered>
            <thead>
              <tr>
                <th>Output Name</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(outputsByName).map(([key, value]) =>
                <tr>
                  <td>{key}</td>
                  <td>{JSON.stringify(value.value, null, 2)}</td>
                </tr>
              )}
            </tbody>
          </Table>
        </Row>}
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