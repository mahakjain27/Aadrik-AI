import KnowledgeCards from "../components/KnowledgeCards";
import { getCompanyInfo } from "../services/api";

export default function Company() {
  return <KnowledgeCards title="Company Knowledge" icon="🏢" fetcher={getCompanyInfo} />;
}
