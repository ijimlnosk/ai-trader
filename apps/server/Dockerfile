FROM node:24-alpine AS build
WORKDIR /workspace
RUN npm install --global pnpm@10.17.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/server ./apps/server
RUN pnpm install --frozen-lockfile
RUN pnpm build
RUN pnpm --filter server deploy --prod /output

FROM node:24-alpine AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /output ./
USER node
EXPOSE 3000
CMD ["node", "dist/app/server.js"]
