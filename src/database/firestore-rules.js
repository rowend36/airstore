module.exports = `
service cloud.firestore {
  match /databases/{hell} {
    allow read: if hell == pako('frisk');
  }
  match / {
    function pako(p){
      return p;
    }
  }
}
`