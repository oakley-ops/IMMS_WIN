// Pages Router redirect → App Router /login
export default function Page() { return null; }
export function getServerSideProps() {
  return { redirect: { destination: '/login', permanent: true } };
}
