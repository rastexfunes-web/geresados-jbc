// Arma el contrato de indumentaria (JBC Egresados) en HTML, con los datos del
// colegio ya cargados. Los datos que falten quedan como línea en blanco para
// completar a mano. Sirve para imprimir/guardar como PDF y para abrir en Word.

const esc = (t) =>
  String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Valor completado (subrayado) o una línea en blanco si no hay dato.
function campo(valor, ancho = 160) {
  const v = String(valor ?? "").trim();
  return v
    ? `<span class="fill">${esc(v)}</span>`
    : `<span class="blank" style="min-width:${ancho}px"></span>`;
}

const moneda = (n) =>
  n || n === 0 ? Number(n).toLocaleString("es-AR") : "";

// "2026-10-30" -> "30 / 10 / 2026". Sin dato, deja los espacios en blanco.
function fechaPartes(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m
    ? `<span class="fill">${m[3]} / ${m[2]} / ${m[1]}</span>`
    : `<span class="blank" style="min-width:20px"></span> / <span class="blank" style="min-width:20px"></span> / <span class="blank" style="min-width:40px"></span>`;
}

const caja = (marcada) => (marcada ? "☑" : "☐");

export function contratoHTML(d) {
  const diaVenc = Number(d.diaVencimiento) || 10;
  const recargo = d.recargo !== "" && d.recargo != null ? Number(d.recargo) : 20;
  const ind = d.indumentaria || {};

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Contrato JBC Egresados - ${esc(d.colegio)}</title>
      <style>
        @page { size: A4; margin: 16mm 16mm 18mm; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #111; line-height: 1.5; }
        h1 { text-align: center; font-size: 26px; margin: 0; }
        h2.sub { text-align: center; font-size: 16px; margin: 4px 0 10px; }
        h3 { color: #2F5496; font-size: 14px; margin: 14px 0 4px; text-transform: uppercase; }
        p { margin: 4px 0; }
        table.cab, table.firmas { width: 100%; border-collapse: collapse; }
        table.cab td, table.firmas td, table.firmas th { font-size: 14px; border: 1px solid #000; padding: 4px 8px; }
        table.cab td { text-align: center; width: 50%; }
        table.firmas th { background: #eee; text-align: left; }
        table.firmas td { padding: 7px 8px; }
        .fill { border-bottom: 1px solid #000; font-weight: bold; padding: 0 4px; }
        .blank { display: inline-block; border-bottom: 1px solid #000; height: 12px; vertical-align: baseline; }
        .linea { display: block; border-bottom: 1px solid #000; height: 18px; margin: 4px 0; }
        .fila { margin: 6px 0; }
        .marcas span { margin-right: 14px; }
        .nobreak { page-break-inside: avoid; }
        footer { text-align: center; font-size: 12px; font-weight: bold; margin-top: 18px; }
      </style>
    </head>
    <body>
      <h1>JBC EGRESADOS</h1>
      <h2 class="sub">CONTRATO DE INDUMENTARIA - PROMO ${esc(d.promo || "2027")}</h2>
      <table class="cab"><tr>
        <td>Fecha: ${fechaPartes(d.fecha)}</td>
        <td>N.º Contrato: ${campo(d.numeroContrato, 120)}</td>
      </tr></table>

      <h3>1. Datos del grupo</h3>
      <div class="fila"><b>Colegio:</b> ${campo(d.colegio, 380)}</div>
      <div class="fila"><b>Localidad:</b> ${campo(d.localidad, 170)} &nbsp; <b>Curso/División:</b> ${campo(d.curso, 150)}</div>
      <div class="fila"><b>Cantidad de alumnos:</b> ${campo(d.cantidadAlumnos, 70)} &nbsp; <b>Delegada/o:</b> ${campo(d.delegada, 200)}</div>
      <div class="fila"><b>DNI:</b> ${campo(d.dniDelegada, 120)} &nbsp; <b>WhatsApp:</b> ${campo(d.whatsapp, 160)}</div>

      <h3>2. Indumentaria contratada</h3>
      <div class="fila marcas">
        <span>${caja(ind.campera)} Campera</span><span>${caja(ind.buzo)} Buzo</span><span>${caja(ind.remera)} Remera</span><span>${caja(ind.chomba)} Chomba</span><span>${caja(ind.pantalon)} Pantalón</span><span>${caja(!!ind.otra)} Otra: ${campo(ind.otra, 90)}</span>
      </div>
      <div class="fila"><b>Modelo / descripción:</b> ${campo(d.modelo, 300)}</div>
      <div class="fila"><b>Colores:</b> ${campo(d.colores, 380)}</div>
      <div class="fila"><b>Bordados / estampados / personalizaciones:</b> ${campo(d.bordados, 220)}</div>
      <div class="fila"><b>Precio total por alumno: $</b> ${campo(moneda(d.precioTotal), 110)} &nbsp; <b>Remera adicional: $</b> ${campo(moneda(d.remeraAdicional), 90)}</div>
      <p>La remera adicional es opcional, tiene costo extra y se adicionará al saldo del alumno que la solicite.</p>

      <h3>3. Precio y forma de pago</h3>
      <div class="fila"><b>Seña: $</b> ${campo(moneda(d.sena), 90)} &nbsp; <b>Cantidad de cuotas:</b> ${campo(d.cuotas, 50)} &nbsp; <b>Valor cuota: $</b> ${campo(moneda(d.valorCuota), 90)}</div>
      <p><b>Vencimiento: del día 1 al ${diaVenc} de cada mes inclusive. A partir del día ${diaVenc + 1}, la cuota tendrá un recargo del ${recargo}%.</b></p>

      <h3>4. Nómina y links de pago</h3>
      <p>La delegada/o enviará a JBC EGRESADOS por WhatsApp la nómina con nombre, apellido, apodo y número de WhatsApp del responsable de cada alumno. JBC EGRESADOS enviará mensualmente a cada contacto informado el link de Mercado Pago correspondiente. Si no fuera recibido, deberá solicitarse su reenvío antes del vencimiento.</p>

      <h3>5. Diseño, talles y personalización</h3>
      <p>El diseño deberá ser aprobado antes de iniciar la producción. Cada alumno deberá confirmar su talle y verificar nombre, apodo, número y demás personalizaciones. Una vez iniciada la producción no se admitirán cambios, salvo autorización de JBC EGRESADOS. Los errores atribuibles a JBC EGRESADOS serán corregidos sin costo.</p>
      <div class="fila"><b>☐ DISEÑO APROBADO</b> &nbsp; Fecha: ${fechaPartes("")} &nbsp; Firma: ${campo("", 170)}</div>

      <h3>6. Bajas y cancelaciones</h3>
      <p>La seña confirma la incorporación al pedido. Una vez iniciada la compra de materiales o la producción, la seña no será reintegrable. Las prendas personalizadas no tendrán cambio ni devolución, excepto por errores atribuibles a JBC EGRESADOS.</p>

      <h3>7. Entrega</h3>
      <div class="fila"><b>Toma de talles:</b> ${fechaPartes(d.tomaTalles)} &nbsp; <b>Entrega estimada:</b> ${d.entrega && /^\d{4}-/.test(d.entrega) ? fechaPartes(d.entrega) : campo(d.entrega, 150)}</div>
      <p>La entrega estará sujeta al cumplimiento del cronograma de pagos acordado.</p>

      <h3>8. Observaciones</h3>
      ${d.observaciones ? `<p>${esc(d.observaciones).replace(/\n/g, "<br/>")}</p>` : `<span class="linea"></span><span class="linea"></span>`}

      <div class="nobreak">
        <h3>9. Conformidad</h3>
        <p>Las partes declaran conocer y aceptar las condiciones del presente contrato. La delegada/o actúa como representante y nexo del grupo, sin asumir personalmente las obligaciones de pago individuales de los alumnos. Se firman dos ejemplares de igual tenor.</p>
        <table class="firmas">
          <tr><th>DELEGADA/O</th><th>JBC EGRESADOS</th></tr>
          <tr><td>Nombre: ${campo(d.delegada, 150)}</td><td>Representante: ${campo(d.representante, 130)}</td></tr>
          <tr><td>DNI: ${campo(d.dniDelegada, 170)}</td><td>DNI: ${campo(d.dniRepresentante, 170)}</td></tr>
          <tr><td>Firma: ${campo("", 170)}</td><td>Firma: ${campo("", 170)}</td></tr>
        </table>
      </div>
      <footer>JBC EGRESADOS - PROMO ${esc(d.promo || "2027")}</footer>
    </body>
  </html>`;
}

// Teléfono para wa.me: si son 10 dígitos (sin código de país) se le antepone 549.
export function telefonoWhatsapp(tel) {
  const t = String(tel || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!t) return "";
  if (t.length === 10) return `549${t}`;
  return t;
}
