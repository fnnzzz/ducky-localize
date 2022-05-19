### Using

`docker run -it -v $(pwd)/localization-artifacts:/app/localization-artifacts -e DB_PASSWORD=<password> -e PLATFORM=<js|android|ios> fnnzzz/ducky-localize:latest`