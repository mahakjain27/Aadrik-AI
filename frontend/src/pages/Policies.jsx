import KnowledgeCards from "../components/KnowledgeCards";
import { getPolicies } from "../services/api";

export default function Policies() {
  return <KnowledgeCards title="Business Policies" icon="📄" fetcher={getPolicies} />;
}
