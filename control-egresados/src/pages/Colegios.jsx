import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listColegios, crearColegio, eliminarColegio } from "../data";

export default function Colegios() {
  const [colegios, setColegios] = useState(null);
  const [showModal, setShowModal] = useState(false);

  async function refresh() {
    setColegios(await listColegios());
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="eyebrow">Panel</div>
          <h1>Colegios</h1>
        </div>
        <button className="btn btn-gold" onClick={() => setShowModal(true)}>
          + Nuevo colegio
        </button>
      </div>

      {colegios === null
