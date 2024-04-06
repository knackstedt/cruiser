# TODO: Once Cruiser is stable, replace this with a bonafide cruiser setup :)

# First, increment the version
git config user.name "GoCD Automation"
git config user.email "no-reply@dotglitch.dev"

# npm version patch
version=$(npm version --json | jq '.["cruiser"]' | tr -d '"')

npm i

# Run the build
cd client
npm i
npm run build

# Install server build deps
cd server
npm i
cd ..

npm run build:server
docker build -f server.dockerfile . -t harbor.dotglitch.dev/library/cruiser:$version

# Once built, push the new build number
git add package.json
git commit -m "⚛ [automation] increment version number"
git push

# Push the new docker image
docker push harbor.dotglitch.dev/library/cruiser:$version

# Inject the version number into the deployment files
sed -i -e "s/:latest/:$version/g" k3s.yml
sed -i -e "s/:latest/:$version/g" k3s.prod.yml
