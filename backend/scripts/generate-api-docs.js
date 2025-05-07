const fs = require('fs');
const path = require('path');
const swaggerSpec = require('../config/swagger');

// Function to generate HTML documentation
const generateHtmlDocs = () => {
  const swaggerUiAssetPath = require.resolve('swagger-ui-dist/swagger-ui.css');
  const swaggerUiJsPath = require.resolve('swagger-ui-dist/swagger-ui-bundle.js');
  const swaggerUiCss = fs.readFileSync(swaggerUiAssetPath, 'utf8');
  const swaggerUiJs = fs.readFileSync(swaggerUiJsPath, 'utf8');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fiserv Inventory API Documentation</title>
    <style>
        ${swaggerUiCss}
        .swagger-ui .topbar { display: none }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script>${swaggerUiJs}</script>
    <script>
        window.onload = () => {
            window.ui = SwaggerUIBundle({
                spec: ${JSON.stringify(swaggerSpec)},
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIBundle.SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "BaseLayout",
                defaultModelsExpandDepth: -1
            });
        };
    </script>
</body>
</html>`;

  const docsDir = path.join(__dirname, '../docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir);
  }

  fs.writeFileSync(path.join(docsDir, 'index.html'), html);
  console.log('HTML documentation generated successfully');
};

// Function to generate OpenAPI/Swagger JSON
const generateJsonSpec = () => {
  const docsDir = path.join(__dirname, '../docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir);
  }

  fs.writeFileSync(
    path.join(docsDir, 'swagger.json'),
    JSON.stringify(swaggerSpec, null, 2)
  );
  console.log('OpenAPI specification generated successfully');
};

// Function to generate Markdown documentation
const generateMarkdownDocs = () => {
  const paths = swaggerSpec.paths;
  let markdown = `# Fiserv Inventory API Documentation\n\n`;

  // Add API information
  markdown += `## API Information\n\n`;
  markdown += `- Version: ${swaggerSpec.info.version}\n`;
  markdown += `- Description: ${swaggerSpec.info.description}\n\n`;

  // Add authentication section
  markdown += `## Authentication\n\n`;
  markdown += `This API uses JWT Bearer token authentication and CSRF protection.\n\n`;

  // Group endpoints by tags
  const endpointsByTag = {};
  Object.entries(paths).forEach(([path, methods]) => {
    Object.entries(methods).forEach(([method, endpoint]) => {
      const tag = endpoint.tags[0];
      if (!endpointsByTag[tag]) {
        endpointsByTag[tag] = [];
      }
      endpointsByTag[tag].push({ path, method, ...endpoint });
    });
  });

  // Generate documentation for each tag
  Object.entries(endpointsByTag).forEach(([tag, endpoints]) => {
    markdown += `## ${tag}\n\n`;

    endpoints.forEach(endpoint => {
      markdown += `### ${endpoint.summary}\n\n`;
      markdown += `\`${endpoint.method.toUpperCase()} ${endpoint.path}\`\n\n`;

      if (endpoint.description) {
        markdown += `${endpoint.description}\n\n`;
      }

      // Parameters
      if (endpoint.parameters && endpoint.parameters.length > 0) {
        markdown += `#### Parameters\n\n`;
        markdown += `| Name | In | Type | Required | Description |\n`;
        markdown += `|------|----|----|-----------|-------------|\n`;
        endpoint.parameters.forEach(param => {
          markdown += `| ${param.name} | ${param.in} | ${param.schema.type} | ${param.required ? 'Yes' : 'No'} | ${param.description || ''} |\n`;
        });
        markdown += `\n`;
      }

      // Request body
      if (endpoint.requestBody) {
        markdown += `#### Request Body\n\n`;
        const content = endpoint.requestBody.content['application/json'];
        if (content.schema.$ref) {
          const schemaName = content.schema.$ref.split('/').pop();
          markdown += `Schema: ${schemaName}\n\n`;
        }
      }

      // Responses
      markdown += `#### Responses\n\n`;
      markdown += `| Status | Description |\n`;
      markdown += `|--------|-------------|\n`;
      Object.entries(endpoint.responses).forEach(([status, response]) => {
        markdown += `| ${status} | ${response.description} |\n`;
      });
      markdown += `\n`;
    });
  });

  // Write markdown file
  const docsDir = path.join(__dirname, '../docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir);
  }

  fs.writeFileSync(path.join(docsDir, 'api.md'), markdown);
  console.log('Markdown documentation generated successfully');
};

// Generate all documentation formats
try {
  generateHtmlDocs();
  generateJsonSpec();
  generateMarkdownDocs();
  console.log('All documentation generated successfully');
} catch (error) {
  console.error('Error generating documentation:', error);
  process.exit(1);
}
