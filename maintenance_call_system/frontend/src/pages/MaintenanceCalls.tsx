// Pages Router redirect → App Router /calls
export default function Page() { return null; }
export function getServerSideProps() {
  return { redirect: { destination: '/calls', permanent: true } };
}
