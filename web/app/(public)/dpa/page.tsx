import Link from 'next/link'
import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { LEGAL } from '@/lib/legal'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Acuerdo de Tratamiento de Datos (DPA) · VitalOS',
  description:
    'Acuerdo de encargado de tratamiento entre el Cliente (Responsable) y VitalOS (Encargado), conforme al art. 25 de la Ley 25.326 de Argentina.',
}

function Section({
  id,
  n,
  title,
  children,
}: {
  id: string
  n: number
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-extrabold text-[#0F1720] mb-4 flex items-baseline gap-3">
        <span className="text-[#00C4BC] tabular-nums">{n}.</span>
        {title}
      </h2>
      <div className="space-y-4 text-[#374151] text-[15px] leading-relaxed">{children}</div>
    </section>
  )
}

export default function DpaPage() {
  const sections: { id: string; title: string }[] = [
    { id: 'objeto', title: 'Objeto y carácter' },
    { id: 'definiciones', title: 'Definiciones' },
    { id: 'roles', title: 'Roles de las partes' },
    { id: 'instrucciones', title: 'Tratamiento según instrucciones' },
    { id: 'confidencialidad', title: 'Confidencialidad' },
    { id: 'seguridad', title: 'Medidas de seguridad' },
    { id: 'subencargados', title: 'Subencargados' },
    { id: 'asistencia', title: 'Asistencia al Responsable' },
    { id: 'incidentes', title: 'Notificación de incidentes' },
    { id: 'transferencia', title: 'Transferencia internacional' },
    { id: 'auditoria', title: 'Auditoría y control' },
    { id: 'devolucion', title: 'Devolución y supresión' },
    { id: 'responsabilidad', title: 'Responsabilidad' },
    { id: 'vigencia', title: 'Vigencia y prelación' },
    { id: 'anexo-a', title: 'Anexo A — Detalle del tratamiento' },
    { id: 'anexo-b', title: 'Anexo B — Medidas de seguridad' },
    { id: 'anexo-c', title: 'Anexo C — Subencargados' },
  ]

  return (
    <div className={`${jakarta.className} min-h-screen bg-white`}>
      <header className="border-b border-[#F3F4F6] bg-white/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="text-xl font-extrabold tracking-tight text-[#0F1720]">
            Vital<span className="text-[#00C4BC]">OS</span>
          </Link>
          <Link href="/register" className="text-sm font-semibold text-[#00C4BC] hover:underline">
            Crear cuenta
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-[#0F1720] mb-3">
            Acuerdo de Tratamiento de Datos (DPA)
          </h1>
          <p className="text-[#6B7280] text-sm">
            Última actualización: {LEGAL.lastUpdated}. Este Acuerdo regula el tratamiento, por parte de
            VitalOS como Encargado, de los datos personales de pacientes que el Cliente, como
            Responsable, carga en el Servicio. Forma parte integrante de los{' '}
            <Link href="/terms" className="text-[#00C4BC] hover:underline">
              Términos y Condiciones
            </Link>{' '}
            y se celebra en los términos del art. 25 de la Ley N° 25.326.
          </p>
        </div>

        <nav className="mb-12 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-5">
          <p className="text-xs font-bold text-[#0F1720] uppercase tracking-wider mb-3">Contenido</p>
          <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-[#374151]">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="hover:text-[#00C4BC] transition-colors">
                  <span className="text-[#9CA3AF] tabular-nums mr-1.5">{i + 1}.</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-10">
          <Section id="objeto" n={1} title="Objeto y carácter">
            <p>
              El presente Acuerdo de Tratamiento de Datos (el &quot;Acuerdo&quot; o &quot;DPA&quot;)
              se celebra entre el <strong>Cliente</strong> (el &quot;Responsable&quot;) y{' '}
              <strong>{LEGAL.operator}</strong>
              {LEGAL.taxId && <>, CUIT <strong>{LEGAL.taxId}</strong></>}, con domicilio de contacto
              en <strong>{LEGAL.address}</strong> (&quot;VitalOS&quot;, el &quot;Encargado&quot;), y
              regula el tratamiento de datos personales de pacientes que el Responsable trata a través
              del Servicio.
            </p>
            <p>
              El Acuerdo se celebra en el marco del art. 25 de la Ley N° 25.326, su Decreto
              reglamentario N° 1558/2001 y las normas de la AAIP. Se perfecciona con la aceptación de
              los Términos y Condiciones al crear la cuenta y queda vigente mientras el Responsable
              utilice el Servicio.
            </p>
          </Section>

          <Section id="definiciones" n={2} title="Definiciones">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Datos personales:</strong> información sobre personas humanas determinadas o
                determinables tratada en el Servicio por cuenta del Responsable.
              </li>
              <li>
                <strong>Datos sensibles:</strong> datos de salud y demás categorías del art. 2 LPDP.
              </li>
              <li>
                <strong>Responsable:</strong> el Cliente, que decide sobre la finalidad y el contenido
                del tratamiento.
              </li>
              <li>
                <strong>Encargado:</strong> VitalOS, que trata los datos por cuenta del Responsable.
              </li>
              <li>
                <strong>Subencargado:</strong> tercero contratado por el Encargado para prestar parte
                del Servicio.
              </li>
              <li>
                <strong>Incidente de seguridad:</strong> toda violación de la seguridad que ocasione
                la destrucción, pérdida, alteración, divulgación o acceso no autorizado a datos
                personales.
              </li>
            </ul>
          </Section>

          <Section id="roles" n={3} title="Roles de las partes">
            <p>
              Las partes acuerdan que, respecto de los datos de pacientes, el{' '}
              <strong>Responsable es el Cliente</strong> y el <strong>Encargado es VitalOS</strong>.
              El Responsable determina la finalidad, el contenido y el alcance del tratamiento; declara
              contar con base legal y, cuando corresponda, con el consentimiento informado de los
              titulares, y es responsable del cumplimiento de la Ley N° 26.529 sobre historia clínica
              y derechos del paciente.
            </p>
          </Section>

          <Section id="instrucciones" n={4} title="Tratamiento según instrucciones">
            <p>El Encargado se obliga a:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                tratar los datos <strong>únicamente</strong> conforme a las instrucciones
                documentadas del Responsable, siendo instrucción suficiente la configuración y el uso
                del Servicio, y con la única finalidad de prestarlo;
              </li>
              <li>
                no utilizar los datos para fines propios ni cederlos a terceros, salvo obligación
                legal, en cuyo caso informará al Responsable cuando esté permitido;
              </li>
              <li>
                informar al Responsable si, a su criterio, una instrucción infringe la normativa de
                protección de datos;
              </li>
              <li>
                no conservar, aplicar ni utilizar los datos con un fin distinto, y no comunicarlos a
                otras personas ni siquiera para su conservación (art. 25.2 LPDP).
              </li>
            </ul>
          </Section>

          <Section id="confidencialidad" n={5} title="Confidencialidad">
            <p>
              El Encargado mantiene el secreto profesional respecto de los datos (art. 10 LPDP),
              obligación que subsiste aun después de finalizada la relación con el Responsable.
              Garantiza que las personas autorizadas a tratar los datos se comprometieron a respetar
              la confidencialidad y acceden solo en la medida estrictamente necesaria para operar o
              dar soporte al Servicio.
            </p>
          </Section>

          <Section id="seguridad" n={6} title="Medidas de seguridad">
            <p>
              El Encargado implementa y mantiene las medidas técnicas y organizativas descriptas en el{' '}
              <a href="#anexo-b" className="text-[#00C4BC] hover:underline">
                Anexo B
              </a>
              , adecuadas al carácter sensible de los datos de salud y alineadas con las medidas
              recomendadas por la AAIP, incluyendo el cifrado de los datos clínicos más sensibles. El
              Encargado podrá actualizar dichas medidas siempre que no disminuya el nivel de
              seguridad.
            </p>
          </Section>

          <Section id="subencargados" n={7} title="Subencargados">
            <p>
              El Responsable autoriza con carácter general al Encargado a recurrir a los subencargados
              listados en el{' '}
              <a href="#anexo-c" className="text-[#00C4BC] hover:underline">
                Anexo C
              </a>{' '}
              (infraestructura en la nube, gestión de claves, mensajería a pacientes, facturación,
              entre otros). El Encargado:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                impone a cada subencargado, por contrato, obligaciones de protección de datos
                equivalentes a las de este Acuerdo;
              </li>
              <li>
                responde frente al Responsable por el cumplimiento del subencargado;
              </li>
              <li>
                informará con antelación razonable la incorporación o sustitución de subencargados,
                pudiendo el Responsable objetarla por motivos razonables de protección de datos.
              </li>
            </ul>
          </Section>

          <Section id="asistencia" n={8} title="Asistencia al Responsable">
            <p>El Encargado asistirá razonablemente al Responsable para:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                atender las solicitudes de ejercicio de derechos de los titulares (acceso,
                rectificación, actualización, supresión y oposición), mediante las funcionalidades del
                Servicio o, de ser necesario, con soporte adicional;
              </li>
              <li>
                cumplir sus obligaciones de seguridad y de gestión de incidentes;
              </li>
              <li>
                responder requerimientos y auditorías de la AAIP u otra autoridad competente.
              </li>
            </ul>
            <p>
              Si el Encargado recibe directamente una solicitud de un titular, la derivará al
              Responsable y no responderá por su cuenta, salvo instrucción en contrario.
            </p>
          </Section>

          <Section id="incidentes" n={9} title="Notificación de incidentes">
            <p>
              El Encargado notificará al Responsable, sin demora indebida desde que tome conocimiento,
              todo incidente de seguridad que afecte a los datos tratados en el Servicio. La
              notificación describirá, en la medida de lo disponible, la naturaleza del incidente, las
              categorías y el volumen aproximado de datos afectados, las posibles consecuencias y las
              medidas adoptadas o propuestas para mitigarlo.
            </p>
            <p>
              La notificación a la AAIP y, cuando corresponda, a los titulares afectados, es
              obligación del Responsable; el Encargado le prestará la asistencia razonable para
              cumplirla.
            </p>
          </Section>

          <Section id="transferencia" n={10} title="Transferencia internacional">
            <p>
              Cuando la prestación del Servicio implique transferir datos a países que no sean
              considerados de protección adecuada por la AAIP, el Encargado la amparará en alguno de
              los mecanismos admitidos por la normativa argentina, en particular las{' '}
              <strong>cláusulas contractuales modelo</strong> aprobadas por la AAIP, que se tendrán por
              incorporadas a este Acuerdo en lo pertinente. El Anexo C identifica los subencargados y
              las ubicaciones relevantes.
            </p>
          </Section>

          <Section id="auditoria" n={11} title="Auditoría y control">
            <p>
              El Encargado pondrá a disposición del Responsable la información razonablemente necesaria
              para demostrar el cumplimiento de este Acuerdo. El Responsable podrá verificar dicho
              cumplimiento mediante informes o certificaciones disponibles y, en caso justificado,
              auditorías acordadas previamente en alcance, tiempo y modo, de forma que no comprometan
              la seguridad o confidencialidad de los datos de otros clientes ni la continuidad del
              Servicio.
            </p>
          </Section>

          <Section id="devolucion" n={12} title="Devolución y supresión de datos">
            <p>
              Finalizada la prestación del Servicio, el Encargado, a elección del Responsable, le
              devolverá los datos en un formato de uso común o los suprimirá, junto con las copias
              existentes, salvo que deba conservarlos por obligación legal. El Encargado mantendrá
              disponible la exportación de datos durante un plazo razonable posterior a la baja.
            </p>
            <p>
              La conservación de la historia clínica por el plazo legal (diez años, Ley N° 26.529)
              corresponde al Responsable como custodio.
            </p>
          </Section>

          <Section id="responsabilidad" n={13} title="Responsabilidad">
            <p>
              Cada parte responde por el incumplimiento de las obligaciones que este Acuerdo y la
              normativa le imponen según su rol. La responsabilidad del Encargado frente al
              Responsable se rige por los límites establecidos en los{' '}
              <Link href="/terms#responsabilidad" className="text-[#00C4BC] hover:underline">
                Términos y Condiciones
              </Link>
              , en la medida permitida por la ley.
            </p>
          </Section>

          <Section id="vigencia" n={14} title="Vigencia y prelación">
            <p>
              Este Acuerdo rige mientras el Encargado trate datos por cuenta del Responsable. En caso
              de conflicto entre este Acuerdo y los Términos y Condiciones respecto del tratamiento de
              datos de pacientes, prevalece este Acuerdo. En lo no previsto, se aplican la Ley N°
              25.326 y sus normas complementarias.
            </p>
          </Section>

          {/* ── Anexos ───────────────────────────────────────────── */}
          <Section id="anexo-a" n={15} title="Anexo A — Detalle del tratamiento">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Objeto:</strong> gestión de agenda, pacientes, historia clínica, finanzas,
                facturación y comunicaciones a través del Servicio.
              </li>
              <li>
                <strong>Duración:</strong> mientras el Responsable use el Servicio.
              </li>
              <li>
                <strong>Naturaleza y finalidad:</strong> almacenamiento, organización, consulta,
                modificación y comunicación de datos para la prestación del Servicio.
              </li>
              <li>
                <strong>Categorías de titulares:</strong> pacientes del Responsable y, en su caso, sus
                representantes.
              </li>
              <li>
                <strong>Categorías de datos:</strong> datos identificatorios y de contacto (nombre,
                DNI, teléfono, email, domicilio), datos de turnos, y{' '}
                <strong>datos sensibles de salud</strong> (antecedentes, alergias, medicación, notas
                clínicas, historia clínica, odontograma, consentimientos informados firmados) y datos
                de facturación.
              </li>
            </ul>
          </Section>

          <Section id="anexo-b" n={16} title="Anexo B — Medidas de seguridad">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Cifrado de datos sensibles en reposo:</strong> los campos clínicos más
                sensibles se cifran a nivel de aplicación con <strong>AES-256-GCM</strong> bajo un
                esquema de envelope encryption: una clave de datos por organización, protegida por una
                clave maestra administrada en un servicio de gestión de claves (KMS) externo. Las
                claves no se almacenan junto a los datos.
              </li>
              <li>
                <strong>Cifrado en tránsito:</strong> todas las comunicaciones por HTTPS/TLS.
              </li>
              <li>
                <strong>Aislamiento multi-tenant:</strong> segregación lógica de los datos por
                organización mediante controles de autorización y reglas de seguridad a nivel de base
                de datos.
              </li>
              <li>
                <strong>Control de accesos:</strong> acceso por rol, autenticación de usuarios y
                acceso del personal del Encargado limitado a lo estrictamente necesario.
              </li>
              <li>
                <strong>Registro de auditoría</strong> de operaciones sensibles, configurado para no
                exponer datos clínicos.
              </li>
              <li>
                <strong>Archivos de pacientes</strong> almacenados en repositorios privados y servidos
                únicamente mediante enlaces firmados de acceso temporal.
              </li>
              <li>
                <strong>Respaldo y recuperación</strong> a cargo de los proveedores de infraestructura.
              </li>
            </ul>
          </Section>

          <Section id="anexo-c" n={17} title="Anexo C — Subencargados">
            <p>
              Los subencargados vigentes, su función y la ubicación de procesamiento se detallan a
              continuación. El listado puede actualizarse conforme a la sección 7. Completá esta tabla
              con tus proveedores reales antes de publicar.
            </p>
            <div className="overflow-x-auto rounded-xl border border-[#E5E7EB]">
              <table className="w-full text-sm">
                <thead className="bg-[#F9FAFB] text-[#0F1720]">
                  <tr>
                    <th className="text-left font-bold px-4 py-3">Proveedor</th>
                    <th className="text-left font-bold px-4 py-3">Función</th>
                    <th className="text-left font-bold px-4 py-3">Ubicación</th>
                  </tr>
                </thead>
                <tbody className="text-[#374151]">
                  {[
                    ['[Proveedor de base de datos / auth / storage]', 'Base de datos, autenticación y almacenamiento', '[Región]'],
                    ['[Proveedor de KMS]', 'Gestión de claves de cifrado', 'EE. UU.'],
                    ['[Proveedor de cache/colas]', 'Cache y procesamiento en segundo plano', '[Región]'],
                    ['[Proveedor de mensajería]', 'Recordatorios y mensajes a pacientes', '[Región]'],
                    ['[Proveedor de facturación/cobros]', 'Facturación electrónica y pagos', '[Región]'],
                    ['[Proveedor de analítica]', 'Analítica de producto', '[Región]'],
                  ].map((row, i) => (
                    <tr key={i} className="border-t border-[#F3F4F6]">
                      <td className="px-4 py-3">{row[0]}</td>
                      <td className="px-4 py-3">{row[1]}</td>
                      <td className="px-4 py-3">{row[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        <div className="mt-16 pt-8 border-t border-[#F3F4F6] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-[#9CA3AF]">© {new Date().getFullYear()} VitalOS. Todos los derechos reservados.</p>
          <div className="flex items-center gap-5 text-sm">
            <Link href="/terms" className="text-[#6B7280] hover:text-[#00C4BC] transition-colors">
              Términos
            </Link>
            <Link href="/privacy" className="text-[#6B7280] hover:text-[#00C4BC] transition-colors">
              Privacidad
            </Link>
            <Link href="/register" className="text-[#00C4BC] font-semibold hover:underline">
              Crear cuenta
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
