> ## Documentation Index
> Fetch the complete documentation index at: https://docs.polymarket.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get public profile by wallet address



## OpenAPI

````yaml api-spec/gamma-openapi.yaml get /public-profile
openapi: 3.0.3
info:
  title: Markets API
  version: 1.0.0
  description: REST API specification for public endpoints used by the Markets service.
servers:
  - url: https://gamma-api.polymarket.com
    description: Polymarket Gamma API Production Server
security: []
tags:
  - name: Gamma Status
    description: Gamma API status and health check
  - name: Sports
    description: Sports-related endpoints including teams and game data
  - name: Tags
    description: Tag management and related tag operations
  - name: Events
    description: Event management and event-related operations
  - name: Markets
    description: Market data and market-related operations
  - name: Comments
    description: Comment system and user interactions
  - name: Series
    description: Series management and related operations
  - name: Profiles
    description: User profile management
  - name: Search
    description: Search functionality across different entity types
paths:
  /public-profile:
    get:
      tags:
        - Profiles
      summary: Get public profile by wallet address
      operationId: getPublicProfile
      parameters:
        - name: address
          in: query
          required: true
          description: The wallet address (proxy wallet or user address)
          schema:
            type: string
            pattern: ^0x[a-fA-F0-9]{40}$
          example: '0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b'
      responses:
        '200':
          description: Public profile information
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PublicProfileResponse'
        '400':
          description: Invalid address format
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PublicProfileError'
              example:
                type: validation error
                error: invalid address
        '404':
          description: Profile not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PublicProfileError'
              example:
                type: not found error
                error: profile not found
components:
  schemas:
    PublicProfileResponse:
      type: object
      properties:
        createdAt:
          type: string
          format: date-time
          description: ISO 8601 timestamp of when the profile was created
          nullable: true
        proxyWallet:
          type: string
          description: The proxy wallet address
          nullable: true
        profileImage:
          type: string
          format: uri
          description: URL to the profile image
          nullable: true
        displayUsernamePublic:
          type: boolean
          description: Whether the username is displayed publicly
          nullable: true
        bio:
          type: string
          description: Profile bio
          nullable: true
        pseudonym:
          type: string
          description: Auto-generated pseudonym
          nullable: true
        name:
          type: string
          description: User-chosen display name
          nullable: true
        users:
          type: array
          description: Array of associated user objects
          nullable: true
          items:
            $ref: '#/components/schemas/PublicProfileUser'
        xUsername:
          type: string
          description: X (Twitter) username
          nullable: true
        verifiedBadge:
          type: boolean
          description: Whether the profile has a verified badge
          nullable: true
    PublicProfileError:
      type: object
      description: Error response for public profile endpoint
      properties:
        type:
          type: string
          description: Error type classification
        error:
          type: string
          description: Error message
    PublicProfileUser:
      type: object
      description: User object associated with a public profile
      properties:
        id:
          type: string
          description: User ID
        creator:
          type: boolean
          description: Whether the user is a creator
        mod:
          type: boolean
          description: Whether the user is a moderator

````

Built with [Mintlify](https://mintlify.com).


> ## Documentation Index
> Fetch the complete documentation index at: https://docs.polymarket.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get public profile by wallet address



## OpenAPI

````yaml api-spec/gamma-openapi.yaml get /public-profile
openapi: 3.0.3
info:
  title: Markets API
  version: 1.0.0
  description: REST API specification for public endpoints used by the Markets service.
servers:
  - url: https://gamma-api.polymarket.com
    description: Polymarket Gamma API Production Server
security: []
tags:
  - name: Gamma Status
    description: Gamma API status and health check
  - name: Sports
    description: Sports-related endpoints including teams and game data
  - name: Tags
    description: Tag management and related tag operations
  - name: Events
    description: Event management and event-related operations
  - name: Markets
    description: Market data and market-related operations
  - name: Comments
    description: Comment system and user interactions
  - name: Series
    description: Series management and related operations
  - name: Profiles
    description: User profile management
  - name: Search
    description: Search functionality across different entity types
paths:
  /public-profile:
    get:
      tags:
        - Profiles
      summary: Get public profile by wallet address
      operationId: getPublicProfile
      parameters:
        - name: address
          in: query
          required: true
          description: The wallet address (proxy wallet or user address)
          schema:
            type: string
            pattern: ^0x[a-fA-F0-9]{40}$
          example: '0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b'
      responses:
        '200':
          description: Public profile information
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PublicProfileResponse'
        '400':
          description: Invalid address format
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PublicProfileError'
              example:
                type: validation error
                error: invalid address
        '404':
          description: Profile not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PublicProfileError'
              example:
                type: not found error
                error: profile not found
components:
  schemas:
    PublicProfileResponse:
      type: object
      properties:
        createdAt:
          type: string
          format: date-time
          description: ISO 8601 timestamp of when the profile was created
          nullable: true
        proxyWallet:
          type: string
          description: The proxy wallet address
          nullable: true
        profileImage:
          type: string
          format: uri
          description: URL to the profile image
          nullable: true
        displayUsernamePublic:
          type: boolean
          description: Whether the username is displayed publicly
          nullable: true
        bio:
          type: string
          description: Profile bio
          nullable: true
        pseudonym:
          type: string
          description: Auto-generated pseudonym
          nullable: true
        name:
          type: string
          description: User-chosen display name
          nullable: true
        users:
          type: array
          description: Array of associated user objects
          nullable: true
          items:
            $ref: '#/components/schemas/PublicProfileUser'
        xUsername:
          type: string
          description: X (Twitter) username
          nullable: true
        verifiedBadge:
          type: boolean
          description: Whether the profile has a verified badge
          nullable: true
    PublicProfileError:
      type: object
      description: Error response for public profile endpoint
      properties:
        type:
          type: string
          description: Error type classification
        error:
          type: string
          description: Error message
    PublicProfileUser:
      type: object
      description: User object associated with a public profile
      properties:
        id:
          type: string
          description: User ID
        creator:
          type: boolean
          description: Whether the user is a creator
        mod:
          type: boolean
          description: Whether the user is a moderator

````

Built with [Mintlify](https://mintlify.com).


> ## Documentation Index
> Fetch the complete documentation index at: https://docs.polymarket.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get closed positions for a user



## OpenAPI

````yaml api-spec/data-openapi.yaml get /closed-positions
openapi: 3.0.3
info:
  title: Polymarket Data API
  version: 1.0.0
  description: >
    HTTP API for Polymarket data. This specification documents all public
    routes.
servers:
  - url: https://data-api.polymarket.com
    description: Relative server (same host)
security: []
tags:
  - name: Data API Status
    description: Data API health check
  - name: Core
  - name: Builders
  - name: Misc
paths:
  /closed-positions:
    get:
      tags:
        - Core
      summary: Get closed positions for a user
      parameters:
        - in: query
          name: user
          required: true
          schema:
            $ref: '#/components/schemas/Address'
          description: The address of the user in question
        - in: query
          name: market
          style: form
          explode: false
          schema:
            type: array
            items:
              $ref: '#/components/schemas/Hash64'
          description: >-
            The conditionId of the market in question. Supports multiple csv
            separated values. Cannot be used with the eventId param.
        - in: query
          name: title
          schema:
            type: string
            maxLength: 100
          description: Filter by market title
        - in: query
          name: eventId
          style: form
          explode: false
          schema:
            type: array
            items:
              type: integer
              minimum: 1
          description: >-
            The event id of the event in question. Supports multiple csv
            separated values. Returns positions for all markets for those event
            ids. Cannot be used with the market param.
        - in: query
          name: limit
          schema:
            type: integer
            default: 10
            minimum: 0
            maximum: 50
          description: The max number of positions to return
        - in: query
          name: offset
          schema:
            type: integer
            default: 0
            minimum: 0
            maximum: 100000
          description: The starting index for pagination
        - in: query
          name: sortBy
          schema:
            type: string
            enum:
              - REALIZEDPNL
              - TITLE
              - PRICE
              - AVGPRICE
              - TIMESTAMP
            default: REALIZEDPNL
          description: The sort criteria
        - in: query
          name: sortDirection
          schema:
            type: string
            enum:
              - ASC
              - DESC
            default: DESC
          description: The sort direction
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/ClosedPosition'
        '400':
          description: Bad Request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '500':
          description: Server Error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
components:
  schemas:
    Address:
      type: string
      description: User Profile Address (0x-prefixed, 40 hex chars)
      pattern: ^0x[a-fA-F0-9]{40}$
      example: '0x56687bf447db6ffa42ffe2204a05edaa20f55839'
    Hash64:
      type: string
      description: 0x-prefixed 64-hex string
      pattern: ^0x[a-fA-F0-9]{64}$
      example: '0xdd22472e552920b8438158ea7238bfadfa4f736aa4cee91a6b86c39ead110917'
    ClosedPosition:
      type: object
      properties:
        proxyWallet:
          $ref: '#/components/schemas/Address'
        asset:
          type: string
        conditionId:
          $ref: '#/components/schemas/Hash64'
        avgPrice:
          type: number
        totalBought:
          type: number
        realizedPnl:
          type: number
        curPrice:
          type: number
        timestamp:
          type: integer
          format: int64
        title:
          type: string
        slug:
          type: string
        icon:
          type: string
        eventSlug:
          type: string
        outcome:
          type: string
        outcomeIndex:
          type: integer
        oppositeOutcome:
          type: string
        oppositeAsset:
          type: string
        endDate:
          type: string
    ErrorResponse:
      type: object
      properties:
        error:
          type: string
      required:
        - error

````

Built with [Mintlify](https://mintlify.com).


> ## Documentation Index
> Fetch the complete documentation index at: https://docs.polymarket.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get user activity



## OpenAPI

````yaml api-spec/data-openapi.yaml get /activity
openapi: 3.0.3
info:
  title: Polymarket Data API
  version: 1.0.0
  description: >
    HTTP API for Polymarket data. This specification documents all public
    routes.
servers:
  - url: https://data-api.polymarket.com
    description: Relative server (same host)
security: []
tags:
  - name: Data API Status
    description: Data API health check
  - name: Core
  - name: Builders
  - name: Misc
paths:
  /activity:
    get:
      tags:
        - Core
      summary: Get user activity
      parameters:
        - in: query
          name: limit
          schema:
            type: integer
            default: 100
            minimum: 0
            maximum: 500
        - in: query
          name: offset
          schema:
            type: integer
            default: 0
            minimum: 0
            maximum: 10000
        - in: query
          name: user
          required: true
          schema:
            $ref: '#/components/schemas/Address'
        - in: query
          name: market
          style: form
          explode: false
          schema:
            type: array
            items:
              $ref: '#/components/schemas/Hash64'
          description: >-
            Comma-separated list of condition IDs. Mutually exclusive with
            eventId.
        - in: query
          name: eventId
          style: form
          explode: false
          schema:
            type: array
            items:
              type: integer
              minimum: 1
          description: Comma-separated list of event IDs. Mutually exclusive with market.
        - in: query
          name: type
          style: form
          explode: false
          schema:
            type: array
            items:
              type: string
              enum:
                - TRADE
                - SPLIT
                - MERGE
                - REDEEM
                - REWARD
                - CONVERSION
                - MAKER_REBATE
        - in: query
          name: start
          schema:
            type: integer
            minimum: 0
        - in: query
          name: end
          schema:
            type: integer
            minimum: 0
        - in: query
          name: sortBy
          schema:
            type: string
            enum:
              - TIMESTAMP
              - TOKENS
              - CASH
            default: TIMESTAMP
        - in: query
          name: sortDirection
          schema:
            type: string
            enum:
              - ASC
              - DESC
            default: DESC
        - in: query
          name: side
          schema:
            type: string
            enum:
              - BUY
              - SELL
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Activity'
        '400':
          description: Bad Request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '500':
          description: Server Error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
components:
  schemas:
    Address:
      type: string
      description: User Profile Address (0x-prefixed, 40 hex chars)
      pattern: ^0x[a-fA-F0-9]{40}$
      example: '0x56687bf447db6ffa42ffe2204a05edaa20f55839'
    Hash64:
      type: string
      description: 0x-prefixed 64-hex string
      pattern: ^0x[a-fA-F0-9]{64}$
      example: '0xdd22472e552920b8438158ea7238bfadfa4f736aa4cee91a6b86c39ead110917'
    Activity:
      type: object
      properties:
        proxyWallet:
          $ref: '#/components/schemas/Address'
        timestamp:
          type: integer
          format: int64
        conditionId:
          $ref: '#/components/schemas/Hash64'
        type:
          type: string
          enum:
            - TRADE
            - SPLIT
            - MERGE
            - REDEEM
            - REWARD
            - CONVERSION
            - MAKER_REBATE
        size:
          type: number
        usdcSize:
          type: number
        transactionHash:
          type: string
        price:
          type: number
        asset:
          type: string
        side:
          type: string
          enum:
            - BUY
            - SELL
        outcomeIndex:
          type: integer
        title:
          type: string
        slug:
          type: string
        icon:
          type: string
        eventSlug:
          type: string
        outcome:
          type: string
        name:
          type: string
        pseudonym:
          type: string
        bio:
          type: string
        profileImage:
          type: string
        profileImageOptimized:
          type: string
    ErrorResponse:
      type: object
      properties:
        error:
          type: string
      required:
        - error

````

Built with [Mintlify](https://mintlify.com).


> ## Documentation Index
> Fetch the complete documentation index at: https://docs.polymarket.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get total value of a user's positions



## OpenAPI

````yaml api-spec/data-openapi.yaml get /value
openapi: 3.0.3
info:
  title: Polymarket Data API
  version: 1.0.0
  description: >
    HTTP API for Polymarket data. This specification documents all public
    routes.
servers:
  - url: https://data-api.polymarket.com
    description: Relative server (same host)
security: []
tags:
  - name: Data API Status
    description: Data API health check
  - name: Core
  - name: Builders
  - name: Misc
paths:
  /value:
    get:
      tags:
        - Core
      summary: Get total value of a user's positions
      parameters:
        - in: query
          name: user
          required: true
          schema:
            $ref: '#/components/schemas/Address'
        - in: query
          name: market
          style: form
          explode: false
          schema:
            type: array
            items:
              $ref: '#/components/schemas/Hash64'
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Value'
        '400':
          description: Bad Request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '500':
          description: Server Error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
components:
  schemas:
    Address:
      type: string
      description: User Profile Address (0x-prefixed, 40 hex chars)
      pattern: ^0x[a-fA-F0-9]{40}$
      example: '0x56687bf447db6ffa42ffe2204a05edaa20f55839'
    Hash64:
      type: string
      description: 0x-prefixed 64-hex string
      pattern: ^0x[a-fA-F0-9]{64}$
      example: '0xdd22472e552920b8438158ea7238bfadfa4f736aa4cee91a6b86c39ead110917'
    Value:
      type: object
      properties:
        user:
          $ref: '#/components/schemas/Address'
        value:
          type: number
    ErrorResponse:
      type: object
      properties:
        error:
          type: string
      required:
        - error

````

Built with [Mintlify](https://mintlify.com).

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.polymarket.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get trades for a user or markets



## OpenAPI

````yaml api-spec/data-openapi.yaml get /trades
openapi: 3.0.3
info:
  title: Polymarket Data API
  version: 1.0.0
  description: >
    HTTP API for Polymarket data. This specification documents all public
    routes.
servers:
  - url: https://data-api.polymarket.com
    description: Relative server (same host)
security: []
tags:
  - name: Data API Status
    description: Data API health check
  - name: Core
  - name: Builders
  - name: Misc
paths:
  /trades:
    get:
      tags:
        - Core
      summary: Get trades for a user or markets
      parameters:
        - in: query
          name: limit
          schema:
            type: integer
            default: 100
            minimum: 0
            maximum: 10000
        - in: query
          name: offset
          schema:
            type: integer
            default: 0
            minimum: 0
            maximum: 10000
        - in: query
          name: takerOnly
          schema:
            type: boolean
            default: true
        - in: query
          name: filterType
          schema:
            type: string
            enum:
              - CASH
              - TOKENS
          description: Must be provided together with filterAmount.
        - in: query
          name: filterAmount
          schema:
            type: number
            minimum: 0
          description: Must be provided together with filterType.
        - in: query
          name: market
          style: form
          explode: false
          schema:
            type: array
            items:
              $ref: '#/components/schemas/Hash64'
          description: >-
            Comma-separated list of condition IDs. Mutually exclusive with
            eventId.
        - in: query
          name: eventId
          style: form
          explode: false
          schema:
            type: array
            items:
              type: integer
              minimum: 1
          description: Comma-separated list of event IDs. Mutually exclusive with market.
        - in: query
          name: user
          schema:
            $ref: '#/components/schemas/Address'
        - in: query
          name: side
          schema:
            type: string
            enum:
              - BUY
              - SELL
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Trade'
        '400':
          description: Bad Request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '500':
          description: Server Error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
components:
  schemas:
    Hash64:
      type: string
      description: 0x-prefixed 64-hex string
      pattern: ^0x[a-fA-F0-9]{64}$
      example: '0xdd22472e552920b8438158ea7238bfadfa4f736aa4cee91a6b86c39ead110917'
    Address:
      type: string
      description: User Profile Address (0x-prefixed, 40 hex chars)
      pattern: ^0x[a-fA-F0-9]{40}$
      example: '0x56687bf447db6ffa42ffe2204a05edaa20f55839'
    Trade:
      type: object
      properties:
        proxyWallet:
          $ref: '#/components/schemas/Address'
        side:
          type: string
          enum:
            - BUY
            - SELL
        asset:
          type: string
        conditionId:
          $ref: '#/components/schemas/Hash64'
        size:
          type: number
        price:
          type: number
        timestamp:
          type: integer
          format: int64
        title:
          type: string
        slug:
          type: string
        icon:
          type: string
        eventSlug:
          type: string
        outcome:
          type: string
        outcomeIndex:
          type: integer
        name:
          type: string
        pseudonym:
          type: string
        bio:
          type: string
        profileImage:
          type: string
        profileImageOptimized:
          type: string
        transactionHash:
          type: string
    ErrorResponse:
      type: object
      properties:
        error:
          type: string
      required:
        - error

````

Built with [Mintlify](https://mintlify.com).

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.polymarket.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get total markets a user has traded



## OpenAPI

````yaml api-spec/data-openapi.yaml get /traded
openapi: 3.0.3
info:
  title: Polymarket Data API
  version: 1.0.0
  description: >
    HTTP API for Polymarket data. This specification documents all public
    routes.
servers:
  - url: https://data-api.polymarket.com
    description: Relative server (same host)
security: []
tags:
  - name: Data API Status
    description: Data API health check
  - name: Core
  - name: Builders
  - name: Misc
paths:
  /traded:
    get:
      tags:
        - Misc
      summary: Get total markets a user has traded
      parameters:
        - in: query
          name: user
          required: true
          schema:
            $ref: '#/components/schemas/Address'
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Traded'
        '400':
          description: Bad Request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '500':
          description: Server Error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
components:
  schemas:
    Address:
      type: string
      description: User Profile Address (0x-prefixed, 40 hex chars)
      pattern: ^0x[a-fA-F0-9]{40}$
      example: '0x56687bf447db6ffa42ffe2204a05edaa20f55839'
    Traded:
      type: object
      properties:
        user:
          $ref: '#/components/schemas/Address'
        traded:
          type: integer
    ErrorResponse:
      type: object
      properties:
        error:
          type: string
      required:
        - error

````

Built with [Mintlify](https://mintlify.com).


> ## Documentation Index
> Fetch the complete documentation index at: https://docs.polymarket.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get total markets a user has traded



## OpenAPI

````yaml api-spec/data-openapi.yaml get /traded
openapi: 3.0.3
info:
  title: Polymarket Data API
  version: 1.0.0
  description: >
    HTTP API for Polymarket data. This specification documents all public
    routes.
servers:
  - url: https://data-api.polymarket.com
    description: Relative server (same host)
security: []
tags:
  - name: Data API Status
    description: Data API health check
  - name: Core
  - name: Builders
  - name: Misc
paths:
  /traded:
    get:
      tags:
        - Misc
      summary: Get total markets a user has traded
      parameters:
        - in: query
          name: user
          required: true
          schema:
            $ref: '#/components/schemas/Address'
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Traded'
        '400':
          description: Bad Request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '500':
          description: Server Error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
components:
  schemas:
    Address:
      type: string
      description: User Profile Address (0x-prefixed, 40 hex chars)
      pattern: ^0x[a-fA-F0-9]{40}$
      example: '0x56687bf447db6ffa42ffe2204a05edaa20f55839'
    Traded:
      type: object
      properties:
        user:
          $ref: '#/components/schemas/Address'
        traded:
          type: integer
    ErrorResponse:
      type: object
      properties:
        error:
          type: string
      required:
        - error

````

Built with [Mintlify](https://mintlify.com).

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.polymarket.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get total markets a user has traded



## OpenAPI

````yaml api-spec/data-openapi.yaml get /traded
openapi: 3.0.3
info:
  title: Polymarket Data API
  version: 1.0.0
  description: >
    HTTP API for Polymarket data. This specification documents all public
    routes.
servers:
  - url: https://data-api.polymarket.com
    description: Relative server (same host)
security: []
tags:
  - name: Data API Status
    description: Data API health check
  - name: Core
  - name: Builders
  - name: Misc
paths:
  /traded:
    get:
      tags:
        - Misc
      summary: Get total markets a user has traded
      parameters:
        - in: query
          name: user
          required: true
          schema:
            $ref: '#/components/schemas/Address'
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Traded'
        '400':
          description: Bad Request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '500':
          description: Server Error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
components:
  schemas:
    Address:
      type: string
      description: User Profile Address (0x-prefixed, 40 hex chars)
      pattern: ^0x[a-fA-F0-9]{40}$
      example: '0x56687bf447db6ffa42ffe2204a05edaa20f55839'
    Traded:
      type: object
      properties:
        user:
          $ref: '#/components/schemas/Address'
        traded:
          type: integer
    ErrorResponse:
      type: object
      properties:
        error:
          type: string
      required:
        - error

````

Built with [Mintlify](https://mintlify.com).

