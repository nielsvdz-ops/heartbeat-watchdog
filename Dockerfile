# A Dockerfile is the recipe for building an image. Each line is a build step.

# 1. Start FROM a base image: a tiny official Node.js 22 on Alpine Linux (~50MB).
FROM node:22-alpine

# 2. Set the working directory inside the container.
WORKDIR /app

# 3. Copy our single source file in. (No package install needed — zero deps.)
COPY watchdog.js .

# 4. Document the port the app listens on (informational; publishing is done at run).
EXPOSE 8080

# 5. The command that runs when the container starts.
CMD ["node", "watchdog.js"]
