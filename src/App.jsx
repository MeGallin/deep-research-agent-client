import { NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
import Builder from "./screens/Builder.jsx";
import RunDetail from "./screens/RunDetail.jsx";
import RunsList from "./screens/RunsList.jsx";

export default function App() {
  return (
    <div className="app">
      <nav className="app-nav">
        <NavLink to="/" end>
          Builder
        </NavLink>
        <NavLink to="/runs">Runs</NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<Builder />} />
        <Route path="/runs" element={<RunsListWrapper />} />
        <Route path="/runs/:runId" element={<RunDetailWrapper />} />
      </Routes>
    </div>
  );
}

function RunsListWrapper() {
  const navigate = useNavigate();
  return (
    <RunsList
      onSelectRun={(id) => {
        navigate(`/runs/${id}`);
      }}
    />
  );
}

function RunDetailWrapper() {
  const { runId } = useParams();
  const navigate = useNavigate();
  return (
    <RunDetail
      runId={runId}
      onBack={() => {
        navigate("/runs");
      }}
    />
  );
}
