import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getColegio,
  listAlumnos,
  crearAlumno,
  eliminarAlumno,
  listCuotasAlumno,
  resumenDeuda,
} from "../data";

export default function ColegioDetail() {
  const { colegioId } = useParams();
  const navigate = useNavigate();
  const [colegio, setColegio] = useState(null);
  const [alumnos, setAlumnos] = useState(null);
  const [resumenes, setResumenes] = useState({});
  const [showModal, setShowModal] =
