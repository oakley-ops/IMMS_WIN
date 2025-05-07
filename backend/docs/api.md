# Fiserv Inventory API Documentation

## API Information

- Version: 1.0.0
- Description: API documentation for the Fiserv Inventory Management System

## Authentication

This API uses JWT Bearer token authentication and CSRF protection.

## Parts

### Get all parts with pagination and filtering

`GET /api/v1/parts`

#### Parameters

| Name | In | Type | Required | Description |
|------|----|----|-----------|-------------|
| page | query | integer | No | Page number |
| limit | query | integer | No | Number of items per page |
| search | query | string | No | Search term for name, description, or part numbers |
| location | query | string | No | Filter by location |
| minQuantity | query | integer | No | Minimum quantity filter |
| maxQuantity | query | integer | No | Maximum quantity filter |

#### Responses

| Status | Description |
|--------|-------------|
| 200 | List of parts |
| 401 | Unauthorized |
| 500 | Server error |

### Create a new part

`POST /api/v1/parts`

#### Request Body

Schema: Part

#### Responses

| Status | Description |
|--------|-------------|
| 201 | Part created successfully |
| 400 | Invalid input |

### Get a specific part by ID

`GET /api/v1/parts/{id}`

#### Parameters

| Name | In | Type | Required | Description |
|------|----|----|-----------|-------------|
| id | path | integer | Yes | Part ID |

#### Responses

| Status | Description |
|--------|-------------|
| 200 | Part details |
| 404 | Part not found |

### Update a part

`PUT /api/v1/parts/{id}`

#### Parameters

| Name | In | Type | Required | Description |
|------|----|----|-----------|-------------|
| id | path | integer | Yes | Part ID |

#### Request Body

Schema: Part

#### Responses

| Status | Description |
|--------|-------------|
| 200 | Part updated successfully |
| 404 | Part not found |

### Delete a part

`DELETE /api/v1/parts/{id}`

#### Parameters

| Name | In | Type | Required | Description |
|------|----|----|-----------|-------------|
| id | path | integer | Yes | Part ID |

#### Responses

| Status | Description |
|--------|-------------|
| 200 | Part deleted successfully |
| 404 | Part not found |

