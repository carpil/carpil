FROM node:22-alpine

# Java requerido por Firebase Emulator Suite
RUN apk add --no-cache openjdk21-jre-headless bash

# Firebase CLI
RUN npm install -g firebase-tools

WORKDIR /firebase

COPY firebase.json .firebaserc firestore.rules firestore.indexes.json storage.rules ./

EXPOSE 4000 8080 9099 9199

CMD ["firebase", "emulators:start", \
     "--project", "demo-carpil", \
     "--import", "./emulator-data", \
     "--export-on-exit", "./emulator-data"]
